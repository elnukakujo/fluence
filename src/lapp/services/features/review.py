from typing import Optional
from sqlalchemy.orm import Session

import logging
logger = logging.getLogger(__name__)

from ...core.database import db_manager, transactional
from ...models.containers import Language, Lesson
from ...models.features import Vocabulary, Grammar, Calligraphy, Exercise
from ...models.system_data import UserPreferences
from ...utils import review_priority
from ..system_data import ScoreService

# Convert the user's daily minutes goal into a card count. Fixed estimate.
# ponytail: SECONDS_PER_CARD fixed; derive from DailyStats.time_studied_ms /
# items_reviewed if a per-user pace ever matters.
SECONDS_PER_CARD = 30.0

# The three flashcard-able feature types, in review (round-robin) order.
FEATURE_MODELS = (Vocabulary, Grammar, Calligraphy, Exercise)


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

        buckets = {model: [] for model in FEATURE_MODELS}
        for model in FEATURE_MODELS:
            cards = session.query(model).filter(model.lesson_id.in_(lesson_ids)).all()
            scores = ScoreService().get_many(user_id, [c.id for c in cards], session=session)
            buckets[model] = sorted(
                cards,
                key=lambda c: review_priority(
                    *self._review_fields(c, scores.get(c.id))
                ),
                reverse=True,
            )

        # Round-robin across the three types so one type can't crowd out the rest.
        queue: list = []
        while len(queue) < max_cards and any(buckets[m] for m in FEATURE_MODELS):
            for model in FEATURE_MODELS:
                if len(queue) >= max_cards:
                    break
                if buckets[model]:
                    queue.append(buckets[model].pop(0))

        if as_dict:
            return [
                {**card.to_dict(include_relations=True), "lesson_title": lesson_title_by_id.get(card.lesson_id)}
                for card in queue
            ]
        return queue

    @staticmethod
    def _review_fields(card, score):
        """Return (created_at, last_seen_at, difficulty, score) for review_priority.

        Unreviewed elements have no Score row: fall back to the element's
        content created_at as a stand-in for both timestamps, with defaults.
        """
        if score is not None:
            return (score.created_at, score.last_seen_at, score.difficulty or 0.0, score.score or 0)
        return (card.created_at, card.created_at, 0.5, 0.0)
