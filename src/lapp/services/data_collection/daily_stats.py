from datetime import datetime, timedelta
from typing import Optional

import logging
logger = logging.getLogger(__name__)
from sqlalchemy import func
from sqlalchemy.orm import Session

from ...core.database import db_manager, transactional
from ...models.data_collection.daily_stats import DailyStats
from ...models.data_collection.progress_tracking import ProgressTracking
from ..system_data import UserPreferencesService
user_preferences_service = UserPreferencesService()
from .commitment_log import CommitmentLogService
commitment_log_service = CommitmentLogService()

class DailyStatsService:
    def _serialize(
        self,
        entry: DailyStats | None,
        as_dict: bool,
        include_relations: bool,
    ) -> DailyStats | dict | None:
        if not as_dict or entry is None:
            return entry
        return entry.to_dict(include_relations=include_relations)

    def _serialize_list(
        self,
        entries: list[DailyStats],
        as_dict: bool,
        include_relations: bool,
    ) -> list[DailyStats] | list[dict]:
        if not as_dict:
            return entries
        return [entry.to_dict(include_relations=include_relations) for entry in entries]

    @transactional
    def has_reached_daily_goal_today(
        self,
        user_id: str,
        language_id: str,
        session: Optional[Session] = None
    ) -> bool:
        """Whether today's streak goal was already hit before this call (used to
        stamp a ProgressTracking row with the state at write time — NOT whether
        this specific review session/answer is "complete")."""
        today: datetime.date = datetime.now().date()
        language_stats = db_manager.find_by_attr(
            model_class=DailyStats,
            attr_values={"user_id": user_id, "language_id": language_id},
            session=session,
            many=True
        )

        today_stats = None
        for stats in list(language_stats or []):
            if stats.created_at.date() == today:
                today_stats = stats
                break
        return today_stats.streak_day is True if today_stats else False

    @transactional
    def get_by_id(
        self,
        daily_stats_id: str,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True,
    ) -> DailyStats | dict | None:
        """Get a DailyStats entry by its ID."""
        entry = db_manager.find_by_attr(
            model_class=DailyStats,
            attr_values={"id": daily_stats_id},
            session=session,
        )
        return self._serialize(entry, as_dict, include_relations)

    @transactional
    def get_range_for_user(
        self,
        user_id: str,
        start_date,
        end_date,
        language_id: Optional[str] = None,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True,
    ) -> list[DailyStats] | list[dict]:
        """Get all DailyStats entries for a user between start_date and end_date (inclusive),
        optionally restricted to a single language; otherwise across all of the user's languages."""
        filters = [
            DailyStats.user_id == user_id,
            func.date(DailyStats.created_at) >= start_date,
            func.date(DailyStats.created_at) <= end_date,
        ]
        if language_id:
            filters.append(DailyStats.language_id == language_id)
        entries = (
            session.query(DailyStats)
            .filter(*filters)
            .order_by(DailyStats.created_at.asc())
            .all()
        )
        return self._serialize_list(entries, as_dict, include_relations)

    @transactional
    def get_today_for_user(
        self,
        user_id: str,
        language_id: str,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True,
    ) -> DailyStats | dict | None:
        """Get today's DailyStats entry for a specific user and language, creating it if needed."""
        today = datetime.now().date()
        entry = (
            session.query(DailyStats)
            .filter(
                DailyStats.user_id == user_id,
                DailyStats.language_id == language_id,
                func.date(DailyStats.created_at) == today,
            )
            .first()
        )

        if entry is None:
            entry = self.create(user_id=user_id, language_id=language_id, session=session)

        return self._serialize(entry, as_dict, include_relations)

    def create(
        self,
        user_id: str,
        language_id: str,
        session: Session,
    ) -> DailyStats:
        entry = DailyStats(
            id=db_manager.generate_new_id(model_class=DailyStats, session=session),
            user_id=user_id,
            language_id=language_id,
            items_reviewed=0,
            items_correct=0,
            time_studied_ms=0,
            streak_day=False,
            current_streak_length=0,
        )
        result = db_manager.insert(obj=entry, session=session, commit=False)
        if result is None:
            raise RuntimeError("Failed to create daily stats entry")
        return result

    @transactional
    def validate_day(self, user_id: str, language_id: str, session: Optional[Session] = None, as_dict: bool = False) -> DailyStats | dict:
        """Mark today a streak day (time goal reached, or the daily review finished). Idempotent: once per day."""
        daily_stats = self.get_today_for_user(user_id=user_id, language_id=language_id, session=session)
        if daily_stats.streak_day:
            return self._serialize(daily_stats, as_dict, False)
        daily_stats.streak_day = True
        logger.info(f"User {user_id} just achieved a streak day for language {language_id}!")

        yesterday = (datetime.now() - timedelta(days=1)).date()
        previous = (
            session.query(DailyStats)
            .filter(
                DailyStats.user_id == user_id,
                DailyStats.language_id == language_id,
                DailyStats.streak_day.is_(True),
                func.date(DailyStats.created_at) == yesterday,
            )
            .order_by(DailyStats.created_at.desc())
            .first()
        )
        daily_stats.current_streak_length = previous.current_streak_length + 1 if previous else 1
        if db_manager.modify(obj=daily_stats, session=session, commit=False) is None:
            raise RuntimeError("Failed to validate the day")
        commitment_log_service.apply_daily_stats(daily_stats_id=daily_stats.id, session=session)
        return self._serialize(daily_stats, as_dict, False)

    def update(
        self,
        progress_tracking_id: str,
        session: Session,
    ) -> DailyStats:
        """
        Apply a progress tracking entry to today's daily stats row.

        This method expects an open session owned by the caller.
        """
        progress_tracking = db_manager.find_by_attr(
            model_class=ProgressTracking,
            attr_values={"id": progress_tracking_id},
            session=session,
        )

        if progress_tracking is None:
            raise ValueError(f"ProgressTracking entry not found: {progress_tracking_id}")

        daily_stats: DailyStats = self.get_today_for_user(
            user_id=progress_tracking.user_id,
            language_id=progress_tracking.language_id,
            session=session,
        )

        if daily_stats is None:
            raise RuntimeError("Failed to load or create today's daily stats entry")

        daily_stats.items_reviewed += 1
        if progress_tracking.result is True:
            daily_stats.items_correct += 1
        daily_stats.time_studied_ms += int(progress_tracking.duration_ms)

        user_preferences = user_preferences_service.get_by_user_id(user_id=progress_tracking.user_id, session=session)
        if user_preferences is None:
            logger.warning(f"User preferences not found for user {progress_tracking.user_id}. Skipping streak day check.")
            daily_goal_ms = 20 * 60 * 1000  # Default to 20 minutes if user preferences are missing
        else:
            daily_goal_ms = user_preferences.daily_goal_minutes * 60 * 1000

        result = db_manager.modify(obj=daily_stats, session=session, commit=False)
        if result is None:
            raise RuntimeError(f"Failed to update daily stats entry for progress tracking {progress_tracking_id}")

        if daily_stats.time_studied_ms >= daily_goal_ms:
            self.validate_day(progress_tracking.user_id, progress_tracking.language_id, session=session)

        return result