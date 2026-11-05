from typing import Optional
from sqlalchemy.orm import Session

import logging
logger = logging.getLogger(__name__)

from ...core.database import db_manager, transactional
from ...models.containers import Language, Lesson
from ...models.features import Vocabulary, Grammar, Calligraphy, Exercise
from ...models.system_data import UserPreferences
from ...utils import review_priority
from ..system_data import ScoreService, ExerciseUserPrefService
from ..system_data.exercise_user_pref import effective_mode
from .side_pattern import make_side_picker
from .study_constants import BOOST_FACTOR
from .study_goal import StudyGoalService
from ..system_data.score import SIDES, side_id

# Convert the user's daily minutes goal into a card count. Fixed estimate.
# ponytail: SECONDS_PER_CARD fixed; derive from DailyStats.time_studied_ms /
# items_reviewed if a per-user pace ever matters.
SECONDS_PER_CARD = 30.0

# The three flashcard-able feature types, in review (round-robin) order.
FEATURE_MODELS = (Vocabulary, Grammar, Calligraphy, Exercise)

# A vocabulary's two sides are kept at least this many cards apart in the queue.
# TODO(user): stand-in value.
VOC_SIDE_GAP = 3


SECTION_MODELS = {"voc": Vocabulary, "gram": Grammar, "ex": Exercise, "call": Calligraphy}


def section_budgets(layout: list[dict], daily_goal_minutes: int) -> dict[str, int]:
    """Cards per section: its own minutes, else an equal share of the daily goal (30 s per card, at least 1)."""
    share = daily_goal_minutes / max(len(layout), 1)
    return {sec["type"]: max(1, round((sec.get("minutes") or share) * 60 / SECONDS_PER_CARD)) for sec in layout}


def order_bucket(items: list, priority_of, goal_rank: dict, boosted_ids: set) -> list:
    """The goal's menu first (new elements, then review ones: `goal_rank` 2 / 1), then by review priority
    (boosted ones multiplied by BOOST_FACTOR), best first."""
    def key(item):
        element = item[0] if isinstance(item, tuple) else item
        weight = BOOST_FACTOR if element.id in boosted_ids else 1.0
        return (goal_rank.get(element.id, 0), priority_of(item) * weight)
    return sorted(items, key=key, reverse=True)


def quotas(lengths: dict, cap: int) -> dict:
    """How many cards each type contributes to a round-robin queue of at most `cap` cards."""
    left, out, total = dict(lengths), {m: 0 for m in lengths}, 0
    while total < cap and any(left.values()):
        for m in FEATURE_MODELS:
            if total >= cap:
                break
            if left.get(m, 0) > 0:
                out[m] += 1
                left[m] -= 1
                total += 1
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


class ReviewService:
    """On-the-fly selection of the daily review queue for a language.

    No persisted SRS state: every card's "should review now" priority is
    computed from fields it already has (created_at / last_seen_at / difficulty
    / score) via review_priority(). The queue interleaves the three flashcard
    types and is capped by the user's daily_goal_minutes.
    """

    @transactional
    def get_review_cards(
        self,
        language_id: str,
        user_id: Optional[str] = None,
        session: Optional[Session] = None,
        as_dict: bool = True,
    ) -> list:
        language = db_manager.find_by_attr(Language, {"id": language_id}, session=session)
        if not language:
            return []

        # Per-user review: default to the language owner when no user is given.
        if user_id is None:
            user_id = language.user_id

        daily_goal_minutes = 20
        preferences = db_manager.find_by_attr(
            UserPreferences, {"user_id": user_id}, session=session
        )
        if preferences is not None and preferences.daily_goal_minutes:
            daily_goal_minutes = preferences.daily_goal_minutes
        max_cards = max(1, round(daily_goal_minutes * 60 / SECONDS_PER_CARD))

        lessons = session.query(Lesson).filter(Lesson.language_id == language_id).all()
        lesson_ids = [lesson.id for lesson in lessons]
        lesson_title_by_id = {lesson.id: lesson.title for lesson in lessons}

        type_prefs = (preferences.exercise_type_prefs if preferences else None) or {}
        layout = preferences.review_layout if preferences else None
        pattern = preferences.voc_side_pattern if preferences else None
        goal_items = StudyGoalService().ensure_cycle(user_id, language_id, session=session)
        goal_rank = {i.element_id: 2 if i.kind == "new" else 1 for i in goal_items}       # new before review
        goal_ids = set(goal_rank)

        # A type covered by the goal's menu serves only that menu (open new elements, then open review ones).
        locked = {m for m, kind in ((Vocabulary, "vocabulary"), (Grammar, "grammar"), (Calligraphy, "calligraphy"))
                  if kind in StudyGoalService().locked_kinds(user_id, language_id, session=session)}

        buckets = {}
        for model in (Vocabulary, Grammar, Calligraphy):
            cards = session.query(model).filter(model.lesson_id.in_(lesson_ids)).all()
            if model in locked:
                cards = [c for c in cards if c.id in goal_ids]
            scores = ScoreService().get_many(user_id, [c.id for c in cards], session=session)
            if model is Vocabulary:
                priority = self._vocabulary_priorities(cards, user_id, session)
                items = [(v, sd) for v in cards for sd in SIDES]
                key_of = lambda it, priority=priority: priority[(it[0].id, it[1])]
            else:
                items = cards
                key_of = lambda c, scores=scores: review_priority(*self._review_fields(c, scores.get(c.id)))
            buckets[model] = order_bucket(items, key_of, goal_rank, set())

        exercises = session.query(Exercise).filter(Exercise.lesson_id.in_(lesson_ids)).all()
        own = ExerciseUserPrefService().modes_for(user_id, [c.id for c in exercises], session=session)
        modes = {c.id: effective_mode(type_prefs, c.exercise_type, own.get(c.id)) for c in exercises}
        exercises = [c for c in exercises if modes[c.id] != "ban"]

        # Cards per type, to know which lessons are in play and how far "all front, then all back" can go.
        budgets = section_budgets(layout, daily_goal_minutes) if layout else None
        if budgets:
            quota = {m: 0 for m in FEATURE_MODELS}
            for sec, left in budgets.items():
                m = SECTION_MODELS[sec]
                quota[m] = min(len(exercises) if m is Exercise else len(buckets[m]), left)
        else:
            quota = quotas({**{m: len(b) for m, b in buckets.items()}, Exercise: len(exercises)}, max_cards)
        buckets[Vocabulary] = pair_vocabulary(buckets[Vocabulary], quota[Vocabulary], split=bool(pattern and pattern.get("mode") == "split"))

        # Exercises come from the lessons of the elements being reviewed (all of them when no element is).
        in_play = {(i[0] if isinstance(i, tuple) else i).lesson_id
                   for m in (Vocabulary, Grammar, Calligraphy) for i in buckets[m][:quota[m]]}
        if in_play:
            exercises = [c for c in exercises if c.lesson_id in in_play]
        boosted = {i for i, m in modes.items() if m == "boost"}
        ex_scores = ScoreService().get_many(user_id, [c.id for c in exercises], session=session)
        buckets[Exercise] = order_bucket(exercises, lambda c: review_priority(*self._review_fields(c, ex_scores.get(c.id))), {}, boosted)

        picker = None
        if pattern and pattern.get("mode") != "split":
            n = len(buckets[Vocabulary]) // len(SIDES)
            picker = make_side_picker(pattern, front_count=n, back_count=n)

        queue: list = []
        sections: list = []
        if layout:
            for sec in layout:
                model, left = SECTION_MODELS[sec["type"]], budgets[sec["type"]]
                while left > 0 and buckets[model]:
                    queue.append(self._pop(buckets[model], queue, model, picker))
                    sections.append(sec["type"])
                    left -= 1
        else:
            # Round-robin across the types so one type can't crowd out the rest.
            while len(queue) < max_cards and any(buckets[m] for m in FEATURE_MODELS):
                for model in FEATURE_MODELS:
                    if len(queue) >= max_cards:
                        break
                    if buckets[model]:
                        queue.append(self._pop(buckets[model], queue, model, picker))
                        sections.append(None)

        if as_dict:
            return [{**self._card_dict(card, lesson_title_by_id), "section": sec} for card, sec in zip(queue, sections)]
        return queue

    @staticmethod
    def _card_dict(card, lesson_title_by_id) -> dict:
        side = None
        if isinstance(card, tuple):
            card, side = card
        out = {**card.to_dict(include_relations=True), "lesson_title": lesson_title_by_id.get(card.lesson_id)}
        if side:
            out["side"] = side
            out["card_id"] = side_id(card.id, side)
        return out

    @staticmethod
    def _vocabulary_priorities(vocabularies, user_id, session) -> dict:
        """review_priority of every (vocabulary id, side), from that side's own Score row."""
        scores = ScoreService().get_many(user_id, [side_id(v.id, sd) for v in vocabularies for sd in SIDES], session=session)
        return {(v.id, sd): review_priority(*ReviewService._review_fields(v, scores.get(side_id(v.id, sd))))
                for v in vocabularies for sd in SIDES}

    @staticmethod
    def _vocabulary_candidates(vocabularies, user_id, session) -> list:
        """One (vocabulary, side) candidate per side, ranked by that side's own review priority."""
        priority = ReviewService._vocabulary_priorities(vocabularies, user_id, session)
        return order_bucket([(v, sd) for v in vocabularies for sd in SIDES], lambda it: priority[(it[0].id, it[1])], {}, set())

    @staticmethod
    def _pop(bucket: list, queue: list, model, picker=None):
        """Take the next card. Vocabulary: skip a side whose sibling was queued within VOC_SIDE_GAP
        cards; with a side picker, prefer the side it asks for."""
        if model is Vocabulary:
            recent = {c[0].id for c in queue[-VOC_SIDE_GAP:] if isinstance(c, tuple)}
            free = [i for i, (v, _s) in enumerate(bucket) if v.id not in recent]
            if free:
                want = picker() if picker else None
                return bucket.pop(next((i for i in free if bucket[i][1] == want), free[0]))
        return bucket.pop(0)

    @staticmethod
    def _review_fields(card, score):
        """Return (created_at, last_seen_at, difficulty, score) for review_priority.

        Unreviewed elements have no Score row: fall back to the element's
        content created_at as a stand-in for both timestamps, with defaults.
        """
        if score is not None:
            return (score.created_at, score.last_seen_at, score.difficulty or 0.0, score.score or 0)
        return (card.created_at, card.created_at, 0.5, 0.0)
