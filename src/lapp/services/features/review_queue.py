"""The review queue as three steps: collect_candidates -> plan_budgets -> build_queue (audit D2).

`collect_candidates` gathers and ranks what could be reviewed, `plan_budgets` decides how much of each type fits in the
learner's time, `build_queue` picks and orders the cards. Behaviour is the pre-split `ReviewService.get_review_cards`.
"""
import random
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal, Optional

from ...core.database import db_manager
from ...models.containers import Language, Lesson
from ...models.features import Vocabulary, Grammar, Calligraphy, Exercise
from ...models.system_data import UserPreferences
from ...utils import review_priority
from ..system_data import ScoreService, ExerciseUserPrefService
from ..system_data.exercise_user_pref import effective_mode
from ..system_data.prefs_view import PrefsView
from ..system_data.score import SIDES, side_id
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

EMPTY_MEAN = {Vocabulary: 8.0, Grammar: 30.0, Calligraphy: 15.0, Exercise: 10.0}   # only used for a type with no cards
SECTION_MODELS = {"voc": Vocabulary, "gram": Grammar, "ex": Exercise, "call": Calligraphy}


def section_minutes(layout: list[dict], daily_goal_minutes: int) -> dict[str, float]:
    """Minutes per section: its own, else an equal share of the daily goal."""
    share = daily_goal_minutes / max(len(layout), 1)
    return {sec["type"]: sec.get("minutes") or share for sec in layout}


def section_budgets(layout: list[dict], daily_goal_minutes: int, mean_seconds: dict[str, float]) -> dict[str, int]:
    """Cards per section: its minutes over that type's mean seconds per card (at least 1)."""
    return {t: max(1, round(minutes * 60 / mean_seconds[t])) for t, minutes in section_minutes(layout, daily_goal_minutes).items()}


def order_bucket(items: list, priority_of, goal_rank: dict, boosted_ids: set) -> list:
    """The goal's menu first (new elements, then review ones: `goal_rank` 2 / 1), then by review priority
    (boosted ones multiplied by BOOST_FACTOR), best first."""
    def key(item):
        element = item[0] if isinstance(item, tuple) else item
        weight = BOOST_FACTOR if element.id in boosted_ids else 1.0
        return (goal_rank.get(element.id, 0), priority_of(item) * weight)
    return sorted(items, key=key, reverse=True)


def quotas(lengths: dict, cap_seconds: float, mean_seconds: dict) -> dict:
    """How many cards each type contributes to a round-robin queue costing at most `cap_seconds` (always at least one card)."""
    left, out, spent, added = dict(lengths), {m: 0 for m in lengths}, 0.0, True
    while added:
        added = False
        for m in FEATURE_MODELS:
            if left.get(m, 0) > 0 and (spent == 0 or spent + mean_seconds[m] <= cap_seconds):
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


def review_fields(card, score):
    """(created_at, last_seen_at, difficulty, score) for review_priority. An unreviewed element has no Score row:
    its content created_at stands in for both timestamps, with defaults."""
    if score is not None:
        return (score.created_at, score.last_seen_at, score.difficulty or 0.0, score.score or 0)
    return (card.created_at, card.created_at, 0.5, 0.0)


def vocabulary_priorities(vocabularies, user_id, session) -> dict:
    """review_priority of every (vocabulary id, side), from that side's own Score row."""
    scores = ScoreService().get_many(user_id, [side_id(v.id, sd) for v in vocabularies for sd in SIDES], session=session)
    return {(v.id, sd): review_priority(*review_fields(v, scores.get(side_id(v.id, sd)))) for v in vocabularies for sd in SIDES}


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
    radicals: bool = False
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


@dataclass
class Budgets:
    """How much fits: cards per type (`quota`), the exercise quota when there is no layout, seconds per card."""
    cap_seconds: float
    daily_goal_minutes: int
    mean_model: dict
    quota: dict
    ex_quota: Optional[int]
    layout: Optional[list]
    pattern: Optional[dict]
    paces: dict


def collect_candidates(user_id: str, language_id: str, scope: Scope, session) -> Optional[Candidates]:
    """Ranked cards per type and the ready exercises. None when the language does not exist."""
    language = db_manager.find_by_attr(Language, {"id": language_id}, session=session)
    if not language:
        return None
    user_id = user_id or language.user_id            # per-user review: default to the language owner
    preferences = db_manager.find_by_attr(UserPreferences, {"user_id": user_id}, session=session)

    lessons = session.query(Lesson).filter(Lesson.language_id == language_id).all()
    lesson_ids = [lesson.id for lesson in lessons]
    lesson_title_by_id = {lesson.id: lesson.title for lesson in lessons}

    type_prefs = (preferences.exercise_type_prefs if preferences else None) or {}
    StudyGoalService().ensure_default(user_id, language_id, session=session)   # no goal yet: the suggested one
    goal_items = StudyGoalService().ensure_cycle(user_id, language_id, session=session)
    goal_rank = {i.element_id: 2 if i.kind == "new" else 1 for i in goal_items}       # new before review
    goal_ids = set(goal_rank)

    # A type covered by the goal's menu serves only that menu (open new elements, then open review ones).
    locked = {m for m, kind in ((Vocabulary, "vocabulary"), (Grammar, "grammar"), (Calligraphy, "calligraphy"))
              if kind in StudyGoalService().locked_kinds(user_id, language_id, session=session)}

    # Still no goal (the user has no preferences yet, so no suggested one): the app works anyway. New elements are drawn at random from a small default window
    # (NO_GOAL_NEW per type, lesson order); seen elements stay candidates by review priority, as before goals.
    no_goal = StudyGoalService().get(user_id, language_id, session=session) is None
    kind_of = {m: k for k, (m, _n, _r) in TYPES.items()}

    buckets = {}
    for model in (Vocabulary, Grammar, Calligraphy):
        cards = session.query(model).filter(model.lesson_id.in_(lesson_ids)).all()
        if model in locked:
            cards = [c for c in cards if c.id in goal_ids]
        elif no_goal:
            unstarted = StudyGoalService._new_elements(model, language_id, user_id, set(), len(cards), session)
            window = set(unstarted[:NO_GOAL_NEW[kind_of[model]]])
            cards = [c for c in cards if c.id in window or c.id not in set(unstarted)]
            random.shuffle(cards)                   # equal priorities (the new ones) then come out in random order
        scores = ScoreService().get_many(user_id, [c.id for c in cards], session=session)
        if model is Vocabulary:
            priority = vocabulary_priorities(cards, user_id, session)
            items = [(v, sd) for v in cards for sd in SIDES]
            key_of = lambda it, priority=priority: priority[(it[0].id, it[1])]
        else:
            items = cards
            key_of = lambda c, scores=scores: review_priority(*review_fields(c, scores.get(c.id)))
        buckets[model] = order_bucket(items, key_of, goal_rank, set())

    exercises = session.query(Exercise).filter(Exercise.lesson_id.in_(lesson_ids), Exercise.review_reason.is_(None)).all()
    exercises = [c for c in exercises if not c.needs]      # only exercises that are really ready (content fits the type, audio present)
    own = ExerciseUserPrefService().modes_for(user_id, [c.id for c in exercises], session=session)
    modes = {c.id: effective_mode(type_prefs, c.exercise_type, own.get(c.id)) for c in exercises}
    exercises = [c for c in exercises if modes[c.id] != "ban"]

    # An exercise appears once the elements it trains are known a little (their scores, never the exercise's own).
    linked = {c.id: [e.id for e in (*c.related_vocabulary, *c.related_grammar, *c.related_calligraphy)] for c in exercises}
    element_scores = ScoreService().get_many(user_id, sorted({i for ids in linked.values() for i in ids}), session=session)
    exercises = [c for c in exercises if is_eligible([element_scores[i].score or 0.0 if i in element_scores else 0.0 for i in linked[c.id]])]

    return Candidates(user_id, language_id, session, scope, preferences, lesson_title_by_id, buckets, exercises, modes)


def card_seconds(card, paces) -> float:
    """What a card costs: its content-based estimate pulled toward this learner's measured pace."""
    return estimate_seconds(card[0] if isinstance(card, tuple) else card, paces)


def plan_budgets(cands: Candidates, prefs: PrefsView, goal: Optional[dict], now: Optional[datetime]) -> Budgets:
    """How many cards of each type fit in the learner's daily minutes (`goal` and `now` are for the decay-aware planner)."""
    session, user_id, buckets, exercises = cands.session, cands.user_id, cands.buckets, cands.exercises
    preferences = cands.preferences
    daily_goal_minutes = prefs.daily_minutes
    cap_seconds = daily_goal_minutes * 60
    layout = preferences.review_layout if preferences else None
    pattern = preferences.voc_side_pattern if preferences else None

    paces = pace_ratios(user_id, session)
    est = lambda c: card_seconds(c, paces)
    mean_model = {m: sum(map(est, pool)) / len(pool) if pool else EMPTY_MEAN[m] for m, pool in {**buckets, Exercise: exercises}.items()}
    mean_sec = {sec: mean_model[m] for sec, m in SECTION_MODELS.items()}

    # Cards per type, to know which lessons are in play and how far "all front, then all back" can go.
    budgets = section_budgets(layout, daily_goal_minutes, mean_sec) if layout else None
    ex_quota = None     # only the free (no menu) queue is capped by the rising share
    if budgets:
        quota = {m: 0 for m in FEATURE_MODELS}
        for sec, left in budgets.items():
            m = SECTION_MODELS[sec]
            quota[m] = min(len(exercises) if m is Exercise else len(buckets[m]), left)
    else:
        # Flashcards first on their own budget to read the learner's knowledge, then the exercises take their rising share of the time.
        flash = quotas({m: len(b) for m, b in buckets.items()}, cap_seconds, mean_model)
        chosen = {i[0].id if isinstance(i, tuple) else i.id: None for m in buckets for i in buckets[m][:flash[m]]}
        shown = ScoreService().get_many(user_id, list(chosen), session=session)
        share = exercise_share(knowledge([shown[i].score or 0.0 if i in shown else 0.0 for i in chosen]))
        ex_quota = exercise_quota(share, cap_seconds, mean_model[Exercise], len(exercises))
        quota = quotas({**{m: len(b) for m, b in buckets.items()}, Exercise: 0}, cap_seconds - ex_quota * mean_model[Exercise], mean_model)
        quota[Exercise] = ex_quota
    return Budgets(cap_seconds, daily_goal_minutes, mean_model, quota, ex_quota, layout, pattern, paces)


def build_queue(cands: Candidates, budgets: Budgets) -> tuple[list, list, list]:
    """Pick and order the cards. Returns (queue, sections, spare exercises): `sections[i]` is the layout section of
    `queue[i]` (None without a layout); the spares are ready exercises that ride along, not part of the queue."""
    from .review import SPARE_EXERCISES      # read at call time (tests patch it there)
    session, user_id = cands.session, cands.user_id
    buckets, exercises = dict(cands.buckets), cands.exercises
    quota, ex_quota, layout, pattern = budgets.quota, budgets.ex_quota, budgets.layout, budgets.pattern
    est = lambda c: card_seconds(c, budgets.paces)

    buckets[Vocabulary] = pair_vocabulary(buckets[Vocabulary], quota[Vocabulary], split=bool(pattern and pattern.get("mode") == "split"))

    # Exercises come from the lessons of the elements being reviewed (all of them when no element is).
    in_play = {(i[0] if isinstance(i, tuple) else i).lesson_id
               for m in (Vocabulary, Grammar, Calligraphy) for i in buckets[m][:quota[m]]}
    if in_play:
        exercises = [c for c in exercises if c.lesson_id in in_play]
    boosted = {i for i, m in cands.modes.items() if m == "boost"}
    ex_scores = ScoreService().get_many(user_id, [c.id for c in exercises], session=session)
    buckets[Exercise] = order_bucket(exercises, lambda c: review_priority(*review_fields(c, ex_scores.get(c.id))), {}, boosted)

    picker = None
    if pattern and pattern.get("mode") != "split":
        n = len(buckets[Vocabulary]) // len(SIDES)
        picker = make_side_picker(pattern, front_count=n, back_count=n)

    queue: list = []
    sections: list = []
    if layout:
        seconds = {t: m * 60 for t, m in section_minutes(layout, budgets.daily_goal_minutes).items()}
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
                    if buckets[model] and (not queue or spent + est(buckets[model][0]) <= budgets.cap_seconds):
                        card = pop_card(buckets[model], queue, model, picker)
                        queue.append(card)
                        sections.append(None)
                        spent += est(card)
                        taken_ex += model is Exercise
                        took = True
            if not took:
                break
    return queue, sections, buckets[Exercise][:SPARE_EXERCISES]
