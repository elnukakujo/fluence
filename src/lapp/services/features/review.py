import random
from difflib import SequenceMatcher
from typing import Optional
from sqlalchemy import func
from sqlalchemy.orm import Session

import logging
logger = logging.getLogger(__name__)

from ...core.database import db_manager, transactional
from ...models.containers import Language, Lesson
from ...models.features import Vocabulary, Grammar, Calligraphy, Exercise
from ...models.components import Word
from ...models.data_collection import ProgressTracking
from ...models.system_data import UserPreferences
from ...utils import review_priority
from ..system_data import ScoreService, ExerciseUserPrefService
from ..system_data.exercise_user_pref import effective_mode
from .side_pattern import make_side_picker
from .study_constants import (BOOST_FACTOR, LEECH_CANDIDATES, LEECH_CONFUSABLE_RATIO, LEECH_LAPSES, NO_GOAL_NEW,
                              SECONDS_PER_CARD_BY_TYPE)
from .study_goal import StudyGoalService, TYPES
from ..system_data.score import SIDES, side_id

# The three flashcard-able feature types, in review (round-robin) order.
FEATURE_MODELS = (Vocabulary, Grammar, Calligraphy, Exercise)

# A vocabulary's two sides are kept at least this many cards apart in the queue.
# TODO(user): stand-in value.
VOC_SIDE_GAP = 3


SECTION_MODELS = {"voc": Vocabulary, "gram": Grammar, "ex": Exercise, "call": Calligraphy}
CARD_SECONDS = {m: SECONDS_PER_CARD_BY_TYPE[sec] for sec, m in SECTION_MODELS.items()}


def section_budgets(layout: list[dict], daily_goal_minutes: int) -> dict[str, int]:
    """Cards per section: its own minutes, else an equal share of the daily goal, over that type's seconds per card (at least 1)."""
    share = daily_goal_minutes / max(len(layout), 1)
    return {sec["type"]: max(1, round((sec.get("minutes") or share) * 60 / SECONDS_PER_CARD_BY_TYPE[sec["type"]])) for sec in layout}


def order_bucket(items: list, priority_of, goal_rank: dict, boosted_ids: set) -> list:
    """The goal's menu first (new elements, then review ones: `goal_rank` 2 / 1), then by review priority
    (boosted ones multiplied by BOOST_FACTOR), best first."""
    def key(item):
        element = item[0] if isinstance(item, tuple) else item
        weight = BOOST_FACTOR if element.id in boosted_ids else 1.0
        return (goal_rank.get(element.id, 0), priority_of(item) * weight)
    return sorted(items, key=key, reverse=True)


def quotas(lengths: dict, cap_seconds: float) -> dict:
    """How many cards each type contributes to a round-robin queue costing at most `cap_seconds` (always at least one card)."""
    left, out, spent, added = dict(lengths), {m: 0 for m in lengths}, 0.0, True
    while added:
        added = False
        for m in FEATURE_MODELS:
            if left.get(m, 0) > 0 and (spent == 0 or spent + CARD_SECONDS[m] <= cap_seconds):
                out[m] += 1
                left[m] -= 1
                spent += CARD_SECONDS[m]
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
        cap_seconds = daily_goal_minutes * 60

        lessons = session.query(Lesson).filter(Lesson.language_id == language_id).all()
        lesson_ids = [lesson.id for lesson in lessons]
        lesson_title_by_id = {lesson.id: lesson.title for lesson in lessons}

        type_prefs = (preferences.exercise_type_prefs if preferences else None) or {}
        layout = preferences.review_layout if preferences else None
        pattern = preferences.voc_side_pattern if preferences else None
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
                priority = self._vocabulary_priorities(cards, user_id, session)
                items = [(v, sd) for v in cards for sd in SIDES]
                key_of = lambda it, priority=priority: priority[(it[0].id, it[1])]
            else:
                items = cards
                key_of = lambda c, scores=scores: review_priority(*self._review_fields(c, scores.get(c.id)))
            buckets[model] = order_bucket(items, key_of, goal_rank, set())

        exercises = session.query(Exercise).filter(Exercise.lesson_id.in_(lesson_ids), Exercise.review_reason.is_(None)).all()
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
            quota = quotas({**{m: len(b) for m, b in buckets.items()}, Exercise: len(exercises)}, cap_seconds)
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
            spent = 0.0
            while any(buckets[m] for m in FEATURE_MODELS):
                took = False
                for model in FEATURE_MODELS:
                    if buckets[model] and (not queue or spent + CARD_SECONDS[model] <= cap_seconds):
                        queue.append(self._pop(buckets[model], queue, model, picker))
                        sections.append(None)
                        spent += CARD_SECONDS[model]
                        took = True
                if not took:
                    break

        if as_dict:
            return [{**self._card_dict(card, lesson_title_by_id), "section": sec} for card, sec in zip(queue, sections)]
        return queue

    @transactional
    def annotate_leeches(self, cards: list[dict], user_id: str, language_id: str, session: Optional[Session] = None) -> list[dict]:
        """Add `leech` ({lapses, parts, confusable}) to the vocabulary and calligraphy cards whose score dropped LEECH_LAPSES times
        (a lapse = a progress row with score_after < score_before). Only leeches cost more than the one grouped query."""
        ids = {c["id"] for c in cards if str(c.get("id", "")).startswith(("voc_", "call_"))}
        if not ids:
            return cards
        lapses = dict(session.query(ProgressTracking.element_id, func.count()).filter(
            ProgressTracking.user_id == user_id, ProgressTracking.element_id.in_(ids), ProgressTracking.score_after < ProgressTracking.score_before,
        ).group_by(ProgressTracking.element_id).all())
        for card in cards:
            n = lapses.get(card.get("id"), 0)
            if n >= LEECH_LAPSES:
                word = session.get(Word, card["word_id"]) if card.get("word_id") else None
                card["leech"] = {"lapses": n,
                                 "parts": [{"character": ch.character, "phonetic": ch.phonetic, "meaning": ch.meaning} for ch in word.characters] if word else [],
                                 "confusable": self._confusable(word, language_id, session) if word else None}
        return cards

    @staticmethod
    def _confusable(word, language_id: str, session: Session) -> dict | None:
        """The other word of the language that looks (or sounds, tones aside) most like `word`; one with the same translation is a synonym, not a confusion."""
        import unicodedata
        plain = lambda s: "".join(c for c in unicodedata.normalize("NFD", (s or "").casefold()) if not unicodedata.combining(c) and not c.isdigit() and not c.isspace())
        best, best_ratio = None, 0.0
        for other in session.query(Word).filter(Word.language_id == language_id, Word.id != word.id).limit(LEECH_CANDIDATES):
            if (other.translation or "").casefold() == (word.translation or "").casefold():
                continue
            ratio = SequenceMatcher(None, word.word, other.word).ratio()
            if word.phonetic and plain(other.phonetic) == plain(word.phonetic):
                ratio = max(ratio, 1.0)
            if ratio >= LEECH_CONFUSABLE_RATIO and ratio > best_ratio:
                best, best_ratio = other, ratio
        return {"word": best.word, "translation": best.translation} if best else None

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
