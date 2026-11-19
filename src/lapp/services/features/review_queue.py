"""The review queue as three steps: collect_candidates -> plan_budgets -> build_queue (audit D2).

`collect_candidates` gathers and ranks what could be reviewed, `plan_budgets` decides how much of each type fits in the
learner's time, `build_queue` picks and orders the cards. Behaviour is the pre-split `ReviewService.get_review_cards`.
"""
import random
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Literal, Optional

from ...core.database import db_manager
from ...models.containers import Language, Lesson
from ...models.components import Character
from ...models.features import Vocabulary, Grammar, Calligraphy, Exercise
from ...models.base import source_element_link, tag_element_link
from ...models.system_data import UserPreferences
from ...utils import review_priority
from ...utils.learner_clock import learner_today
from ...utils.scoring import INITIAL_STABILITY_DAYS, is_replaced
from ..system_data import ScoreService, ExerciseUserPrefService
from ..system_data.exercise_user_pref import effective_mode
from ..system_data.prefs_view import PrefsView, prefs_for
from ..system_data.settings import resolve
from ..system_data.score import SIDES, side_id
from ...utils.helpers import base_element_id
from .card_time import estimate_seconds, pace_ratios
from .exercise_share import exercise_quota, exercise_share, is_eligible, knowledge
from .side_pattern import make_side_picker
from .study_constants import BOOST_FACTOR, NO_GOAL_NEW
from .study_goal import StudyGoalService, TYPES

# The flashcard-able feature types, in review (round-robin) order.
FEATURE_MODELS = (Vocabulary, Grammar, Calligraphy, Exercise)

# A vocabulary's two sides are kept at least this many cards apart in the queue.
# TODO(user): stand-in value.
VOC_SIDE_GAP = 3

SECTION_MODELS = {"voc": Vocabulary, "gram": Grammar, "ex": Exercise, "call": Calligraphy}


def section_budgets(layout: list[dict], reviews_per_day: int) -> dict[str, int]:
    """Cards per section: its own count, else an equal share of the day's reviews (at least 1)."""
    share = max(1, round(reviews_per_day / max(len(layout), 1)))
    return {sec["type"]: sec.get("count") or share for sec in layout}


def order_bucket(items: list, priority_of, goal_rank: dict, boosted_ids: set, capped_ids: frozenset = frozenset()) -> list:
    """Items already at today's gain cap last (more answers earn nothing, spec G3); then the goal's menu (new elements,
    then review ones: `goal_rank` 2 / 1); then by review priority (boosted ones multiplied by BOOST_FACTOR), best first.
    `capped_ids` holds element ids, and `voc_x#front` side ids for vocabulary tuples."""
    def key(item):
        element, side = item if isinstance(item, tuple) else (item, None)
        weight = BOOST_FACTOR if element.id in boosted_ids else 1.0
        capped = (side_id(element.id, side) if side else element.id) in capped_ids
        return (not capped, goal_rank.get(element.id, 0), priority_of(item) * weight)
    return sorted(items, key=key, reverse=True)


def quotas(lengths: dict, cap: float, mean_seconds: dict) -> dict:
    """How many cards each type contributes to a round-robin queue costing at most `cap` (always at least one card; a card costs 1)."""
    left, out, spent, added = dict(lengths), {m: 0 for m in lengths}, 0.0, True
    while added:
        added = False
        for m in FEATURE_MODELS:
            if left.get(m, 0) > 0 and (spent == 0 or spent + mean_seconds[m] <= cap):
                out[m] += 1
                left[m] -= 1
                spent += mean_seconds[m]
                added = True
    return out


def pair_vocabulary(bucket: list, quota: int, split: bool = False) -> list:
    """Both sides of a vocabulary are always reviewed together: keep the best quota // 2 vocabularies (fewer words
    when the budget is tight, never half a word) with their two sides. `split` serves all fronts, then their backs;
    otherwise the sides stay in priority order for the side mix to arrange."""
    chosen, seen = [], set()
    for v, _side in bucket:
        if v.id not in seen and len(chosen) < quota // 2:
            seen.add(v.id)
            chosen.append(v)
    if split:
        return [(v, "front") for v in chosen] + [(v, "back") for v in chosen]
    return [it for it in bucket if it[0].id in seen]


def priority_for(inputs: dict, element_id: str, now: datetime) -> float:
    """review_priority of one element from its ScoreService.priority_inputs row (none yet = unseen)."""
    pi = inputs.get(element_id)
    if pi is None:
        return review_priority(0.0, INITIAL_STABILITY_DAYS, None, 0, now)
    return review_priority(pi.score, pi.stability, pi.last_seen_at, pi.lapses, now) * pi.weight     # a grammar the exercises are replacing fades (SC-30)


def item_skill(card_id: str, side: Optional[str]) -> str:
    """The skill an answer on this card trains (mirrors client `skillFor`): grammar recognises, a vocabulary face decides, the rest recall."""
    if card_id.startswith("gram_"):
        return "recognition"
    if card_id.startswith("voc_"):
        return "recall" if side == "back" else "recognition"
    return "recall"


def pop_card(bucket: list, queue: list, model, picker=None):
    """Take the next card. Vocabulary: skip a side whose sibling was queued within VOC_SIDE_GAP
    cards; with a side picker, prefer the side it asks for."""
    if model is Vocabulary:
        recent = {c[0].id for c in queue[-VOC_SIDE_GAP:] if isinstance(c, tuple)}
        free = [i for i, (v, _s) in enumerate(bucket) if v.id not in recent]
        if free:
            want = picker() if picker else None
            return bucket.pop(next((i for i in free if bucket[i][1] == want), free[0]))
    return bucket.pop(0)


@dataclass
class Scope:
    """What a queue is drawn from. Only `daily` is served today; the other kinds arrive with the scoped queue."""
    kind: Literal["daily", "lesson", "tag", "source", "type", "free"] = "daily"
    lesson_id: Optional[str] = None
    tag_id: Optional[str] = None
    source_id: Optional[str] = None
    element_type: Optional[str] = None
    ids: list[str] = field(default_factory=list)


@dataclass
class Candidates:
    """Everything `collect_candidates` found: ranked buckets per type plus the context the next steps need."""
    user_id: str
    language_id: str
    session: object
    scope: Scope
    preferences: Optional[UserPreferences]
    lesson_title_by_id: dict
    buckets: dict           # model -> ranked items ((vocabulary, side) tuples for Vocabulary)
    exercises: list         # ready, eligible, not banned (unranked)
    modes: dict             # exercise id -> effective mode (boost/ban/None)
    now: datetime
    today: date             # the learner's day
    bonus_ids: set = field(default_factory=set)    # served after the goal's menu is done (spec G4)


@dataclass
class Budgets:
    """How much fits: cards per type (`quota`), the exercise quota when there is no layout. A card counts for 1."""
    cap: float          # cards in the day's queue (the learner's reviews per day)
    mean_model: dict
    quota: dict
    ex_quota: Optional[int]
    layout: Optional[list]
    pattern: Optional[dict]
    paces: dict


MODEL_OF_TYPE = {"vocabulary": Vocabulary, "grammar": Grammar, "calligraphy": Calligraphy, "character": Calligraphy, "exercise": Exercise}


def _scope_ids(scope: Scope, session) -> set:
    """Element ids a tag / source / free scope names."""
    if scope.kind == "free":
        return {base_element_id(i) for i in scope.ids}
    link, col, wanted = (tag_element_link, tag_element_link.c.tag_id, scope.tag_id) if scope.kind == "tag" else \
                        (source_element_link, source_element_link.c.source_id, scope.source_id)
    return {r[0] for r in session.execute(link.select().with_only_columns(link.c.element_id).where(col == wanted))}


def _keep_in_scope(scope: Scope, ids: set):
    """Predicate on a Vocabulary/Grammar/Calligraphy card for the non-daily scopes (a tagged lesson, word or character
    brings its cards)."""
    def keep(card) -> bool:
        if scope.kind == "lesson":
            return True                                         # the lesson filter is applied by the query
        if scope.kind == "type":
            return True
        return card.id in ids or card.lesson_id in ids or getattr(card, "word_id", None) in ids or getattr(card, "character_id", None) in ids
    return keep


def collect_candidates(user_id: str, language_id: str, scope: Scope, session) -> Optional[Candidates]:
    """Ranked cards per type and the ready exercises. None when the language does not exist.

    `daily`: the goal's menu first, then the review ones by priority; a type the goal covers serves its menu, then
    bonus items (already started, never unstarted). Other scopes: every card of the scope in natural order (lesson
    position, creation), no goal and no time budget (RE-4/5); `free` is exactly the ids given (RE-6)."""
    language = db_manager.find_by_attr(Language, {"id": language_id}, session=session)
    if not language:
        return None
    user_id = user_id or language.user_id            # per-user review: default to the language owner
    preferences = db_manager.find_by_attr(UserPreferences, {"user_id": user_id}, session=session)
    now = datetime.now()
    today = learner_today(prefs_for(user_id, language_id, session).timezone, now)
    daily = scope.kind == "daily"

    lessons = session.query(Lesson).filter(Lesson.language_id == language_id).order_by(Lesson.position, Lesson.created_at).all()
    lesson_title_by_id = {lesson.id: lesson.title for lesson in lessons}
    lesson_pos = {lesson.id: n for n, lesson in enumerate(lessons)}
    lesson_ids = [lesson.id for lesson in lessons if scope.kind != "lesson" or lesson.id == scope.lesson_id]

    type_prefs = (preferences.exercise_type_prefs if preferences else None) or {}
    goal_rank, goal_ids, locked, no_goal = {}, set(), set(), False
    if daily:
        StudyGoalService().ensure_default(user_id, language_id, session=session)   # no goal yet: the suggested one
        goal_items = StudyGoalService().ensure_cycle(user_id, language_id, session=session)
        goal_rank = {i.element_id: 2 if i.kind == "new" else 1 for i in goal_items}       # new before review
        goal_ids = set(goal_rank)
        # A type covered by the goal's menu serves that menu (open new elements, then open review ones), then bonus items.
        locked = {m for m, kind in ((Vocabulary, "vocabulary"), (Grammar, "grammar"), (Calligraphy, "calligraphy"))
                  if kind in StudyGoalService().locked_kinds(user_id, language_id, session=session)}
        # Still no goal (the user has no preferences yet, so no suggested one): the app works anyway. New elements are drawn at random from a small default window
        # (NO_GOAL_NEW per type, lesson order); seen elements stay candidates by review priority, as before goals.
        no_goal = StudyGoalService().get(user_id, language_id, session=session) is None
    kind_of = {m: k for k, (m, _n, _r) in TYPES.items()}

    ids = _scope_ids(scope, session) if scope.kind in ("tag", "source", "free") else set()
    keep = _keep_in_scope(scope, ids)
    models = (MODEL_OF_TYPE[scope.element_type],) if scope.kind == "type" and scope.element_type in MODEL_OF_TYPE else (Vocabulary, Grammar, Calligraphy)
    wanted = resolve(user_id, language_id, "element_types", session=session) if scope.kind not in ("type", "free") else None     # the course's own choice; a named type or card is always served
    if wanted is not None:
        models = tuple(m for m in models if kind_of[m] in wanted)
    scoped_cards = {}
    for model in (Vocabulary, Grammar, Calligraphy):
        cards = session.query(model).filter(model.lesson_id.in_(lesson_ids)).all() if model in models else []
        if not daily:
            cards = sorted((c for c in cards if keep(c)), key=lambda c: (lesson_pos[c.lesson_id], c.created_at, c.id))
            if scope.kind == "free":
                cards = [c for c in cards if c.id in ids]
        scoped_cards[model] = cards

    # Review-priority inputs for every card (a vocabulary's sides separately).
    all_ids = [c.id for cs in scoped_cards.values() for c in cs]
    side_ids = [side_id(i, sd) for i in all_ids if i.startswith("voc_") for sd in SIDES]
    inputs = ScoreService().priority_inputs(user_id, [*all_ids, *side_ids], now, today, session=session)
    capped = frozenset(i for i, pi in inputs.items() if pi.capped)
    if daily:       # a grammar fully replaced by exercises is no longer read in the daily queue; explicit scopes still serve it (SC-30)
        scoped_cards[Grammar] = [c for c in scoped_cards[Grammar] if not (c.id in inputs and is_replaced(inputs[c.id].weight))]

    bonus_ids: set = set()
    buckets = {}
    for model in (Vocabulary, Grammar, Calligraphy):
        cards = scoped_cards[model]
        if model in locked:
            menu, rest = [c for c in cards if c.id in goal_ids], [c for c in cards if c.id not in goal_ids]
            started = [c for c in rest if (pi := inputs.get(c.id)) is not None and pi.last_seen_at is not None]   # never unstarted
            bonus_ids |= {c.id for c in started}
            cards = menu + started
        elif no_goal and daily:
            unstarted = StudyGoalService._new_elements(model, language_id, user_id, set(), len(cards), session)
            window = set(unstarted[:NO_GOAL_NEW[kind_of[model]]])
            cards = [c for c in cards if c.id in window or c.id not in set(unstarted)]
            random.shuffle(cards)                   # equal priorities (the new ones) then come out in random order
        items = [(v, sd) for v in cards for sd in SIDES] if model is Vocabulary else cards
        if not daily:
            buckets[model] = items
        elif model is Vocabulary:
            buckets[model] = order_bucket(items, lambda it: priority_for(inputs, side_id(it[0].id, it[1]), now), goal_rank, set(), capped)
        else:
            buckets[model] = order_bucket(items, lambda c: priority_for(inputs, c.id, now), goal_rank, set(), capped)

    exercises, modes = _ready_exercises(user_id, language_id, scope, lesson_ids, buckets, ids, type_prefs, models, session)
    if wanted is not None and "exercises" not in wanted:
        exercises, modes = [], {}
    return Candidates(user_id, language_id, session, scope, preferences, lesson_title_by_id, buckets, exercises, modes, now, today, bonus_ids)


def _ready_exercises(user_id, language_id, scope, lesson_ids, buckets, ids, type_prefs, models, session):
    """Ready (content fits, audio present), not banned exercises of the scope, past the linked-average gate (`free` skips the gate:
    the learner named them)."""
    if scope.kind == "type" and Exercise not in models:
        pool = []
        if scope.element_type in MODEL_OF_TYPE:                 # a type other than exercise: those linked to its cards
            in_scope = {c[0].id if isinstance(c, tuple) else c.id for b in buckets.values() for c in b}
            pool = [e for e in session.query(Exercise).filter(Exercise.lesson_id.in_(lesson_ids), Exercise.review_reason.is_(None)).all()
                    if in_scope & {x.id for x in (*e.related_vocabulary, *e.related_grammar, *e.related_calligraphy)}]
    else:
        pool = session.query(Exercise).filter(Exercise.lesson_id.in_(lesson_ids), Exercise.review_reason.is_(None)).all()
        if scope.kind in ("tag", "source", "free"):
            in_scope = {c[0].id if isinstance(c, tuple) else c.id for b in buckets.values() for c in b}
            pool = [e for e in pool if e.id in ids or e.lesson_id in ids
                    or in_scope & {x.id for x in (*e.related_vocabulary, *e.related_grammar, *e.related_calligraphy)}]
            if scope.kind == "free":
                pool = [e for e in pool if e.id in ids]
    exercises = [c for c in pool if not c.needs]
    own = ExerciseUserPrefService().modes_for(user_id, [c.id for c in exercises], session=session)
    modes = {c.id: effective_mode(type_prefs, c.exercise_type, own.get(c.id)) for c in exercises}
    exercises = [c for c in exercises if modes[c.id] != "ban"]
    if scope.kind != "free":
        # An exercise appears once the elements it trains are known a little (their scores, never the exercise's own).
        linked = {c.id: [e.id for e in (*c.related_vocabulary, *c.related_grammar, *c.related_calligraphy)] for c in exercises}
        element_scores = ScoreService().get_many(user_id, sorted({i for ids_ in linked.values() for i in ids_}), session=session)
        exercises = [c for c in exercises if is_eligible([element_scores[i].score or 0.0 if i in element_scores else 0.0 for i in linked[c.id]])]
    return exercises, modes


def card_seconds(card, paces) -> float:
    """What a card costs: its content-based estimate pulled toward this learner's measured pace."""
    return estimate_seconds(card[0] if isinstance(card, tuple) else card, paces)


def plan_budgets(cands: Candidates, prefs: PrefsView, goal: Optional[dict], now: Optional[datetime]) -> Budgets:
    """How many cards of each type fit in the learner's reviews per day (`goal` and `now` are for the decay-aware planner)."""
    session, user_id, buckets, exercises = cands.session, cands.user_id, cands.buckets, cands.exercises
    preferences = cands.preferences
    cap = prefs.reviews_per_day
    if cands.scope.kind != "daily":     # lesson / tag / source / type / free review: everything in scope, no time budget, no quotas (RE-4..6)
        quota = {**{m: len(b) for m, b in buckets.items()}, Exercise: len(exercises)}
        pattern = preferences.voc_side_pattern if preferences else None
        return Budgets(float("inf"), {}, quota, None, None, pattern, pace_ratios(user_id, session))
    layout = preferences.review_layout if preferences else None
    pattern = preferences.voc_side_pattern if preferences else None

    paces = pace_ratios(user_id, session)
    mean_model = {m: 1.0 for m in (*buckets, Exercise)}     # every card counts for one

    # Cards per type, to know which lessons are in play and how far "all front, then all back" can go.
    budgets = section_budgets(layout, cap) if layout else None
    ex_quota = None     # only the free (no menu) queue is capped by the rising share
    if budgets:
        quota = {m: 0 for m in FEATURE_MODELS}
        for sec, left in budgets.items():
            m = SECTION_MODELS[sec]
            quota[m] = min(len(exercises) if m is Exercise else len(buckets[m]), left)
    else:
        # Flashcards first on their own budget to read the learner's knowledge, then the exercises take their rising share of the time.
        flash = quotas({m: len(b) for m, b in buckets.items()}, cap, mean_model)
        chosen = {i[0].id if isinstance(i, tuple) else i.id: None for m in buckets for i in buckets[m][:flash[m]]}
        shown = ScoreService().get_many(user_id, list(chosen), session=session)
        share = exercise_share(knowledge([shown[i].score or 0.0 if i in shown else 0.0 for i in chosen]))
        ex_quota = exercise_quota(share, cap, mean_model[Exercise], len(exercises))
        quota = quotas({**{m: len(b) for m, b in buckets.items()}, Exercise: 0}, cap - ex_quota * mean_model[Exercise], mean_model)
        quota[Exercise] = ex_quota
    return Budgets(cap, mean_model, quota, ex_quota, layout, pattern, paces)


def build_queue(cands: Candidates, budgets: Budgets) -> tuple[list, list, list]:
    """Pick and order the cards. Returns (queue, sections, spare exercises): `sections[i]` is the layout section of
    `queue[i]` (None without a layout); the spares are ready exercises that ride along, not part of the queue."""
    from .review import SPARE_EXERCISES      # read at call time (tests patch it there)
    session, user_id = cands.session, cands.user_id
    buckets, exercises = dict(cands.buckets), cands.exercises
    quota, ex_quota, layout, pattern = budgets.quota, budgets.ex_quota, budgets.layout, budgets.pattern
    est = lambda c: 1.0      # every card counts for one

    buckets[Vocabulary] = pair_vocabulary(buckets[Vocabulary], quota[Vocabulary], split=bool(pattern and pattern.get("mode") == "split"))

    # Exercises come from the lessons of the elements being reviewed (all of them when no element is).
    in_play = {(i[0] if isinstance(i, tuple) else i).lesson_id
               for m in (Vocabulary, Grammar, Calligraphy) for i in buckets[m][:quota[m]]}
    daily = cands.scope.kind == "daily"
    if in_play and daily:
        exercises = [c for c in exercises if c.lesson_id in in_play]
    boosted = {i for i, m in cands.modes.items() if m == "boost"}
    inputs = ScoreService().priority_inputs(user_id, [c.id for c in exercises], cands.now, cands.today, session=session)
    capped = frozenset(i for i, pi in inputs.items() if pi.capped)
    if daily:
        buckets[Exercise] = order_bucket(exercises, lambda c: priority_for(inputs, c.id, cands.now), {}, boosted, capped)
    else:
        buckets[Exercise] = list(exercises)         # natural order

    picker = None
    if pattern and pattern.get("mode") != "split":
        n = len(buckets[Vocabulary]) // len(SIDES)
        picker = make_side_picker(pattern, front_count=n, back_count=n)

    queue: list = []
    sections: list = []
    if layout:
        seconds = section_budgets(layout, budgets.cap)
        for sec in layout:
            model, left = SECTION_MODELS[sec["type"]], seconds[sec["type"]]
            while buckets[model] and (left == seconds[sec["type"]] or est(buckets[model][0]) <= left):   # a section always serves its first card
                card = pop_card(buckets[model], queue, model, picker)
                queue.append(card)
                sections.append(sec["type"])
                left -= est(card)
    else:
        # Round-robin across the types so one type can't crowd out the rest.
        spent, taken_ex = 0.0, 0
        turns = {m: 1 for m in FEATURE_MODELS}
        if ex_quota is not None:
            turns[Exercise] = max(1, -(-ex_quota // max(1, *(quota[m] for m in FEATURE_MODELS if m is not Exercise))))
        while any(buckets[m] for m in FEATURE_MODELS):
            took = False
            for model in FEATURE_MODELS:
                for _ in range(turns[model]):
                    if model is Exercise and ex_quota is not None and taken_ex >= ex_quota:
                        break
                    if buckets[model] and (not queue or spent + est(buckets[model][0]) <= budgets.cap):
                        card = pop_card(buckets[model], queue, model, picker)
                        queue.append(card)
                        sections.append(None)
                        spent += est(card)
                        taken_ex += model is Exercise
                        took = True
            if not took:
                break
    return queue, sections, buckets[Exercise][:SPARE_EXERCISES]
