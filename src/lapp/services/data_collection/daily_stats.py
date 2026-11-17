from datetime import date, datetime
from typing import Optional

import logging
logger = logging.getLogger(__name__)
from sqlalchemy import func
from sqlalchemy.orm import Session

from ...core.database import db_manager, transactional
from ...models.data_collection.daily_stats import DailyStats
from ...models.data_collection.progress_tracking import ProgressTracking
from ...utils.learner_clock import learner_today
from ..system_data.prefs_view import prefs_for

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
        day: Optional[date] = None,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True,
    ) -> DailyStats | dict | None:
        """The day's DailyStats entry for a user and language (the learner's day, default today), created if needed.
        Its streak fields mirror the learner-wide streak (`LearnerDay`), not a per-language one."""
        from .study_activity import status_for
        day = day or learner_today(prefs_for(user_id, language_id, session).timezone)
        entry = (
            session.query(DailyStats)
            .filter(
                DailyStats.user_id == user_id,
                DailyStats.language_id == language_id,
                func.date(DailyStats.created_at) == day,
            )
            .first()
        )
        if entry is None:
            entry = self.create(user_id=user_id, language_id=language_id, day=day, session=session)
        status = status_for(user_id, day, session)
        entry.streak_day, entry.current_streak_length = status.validated, status.streak
        return self._serialize(entry, as_dict, include_relations)

    def create(
        self,
        user_id: str,
        language_id: str,
        session: Session,
        day: Optional[date] = None,
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
            # created_at carries the learner's day (its date part is what every query matches on)
            created_at=datetime.combine(day, datetime.now().time()) if day else datetime.now(),
        )
        result = db_manager.insert(obj=entry, session=session, commit=False)
        if result is None:
            raise RuntimeError("Failed to create daily stats entry")
        return result

    @transactional
    def mark_streak_day(self, user_id: str, language_id: str, day: date, length: int, session: Optional[Session] = None) -> DailyStats:
        """Stamp the language's row of a validated learner day (the learner's streak, once)."""
        entry = self.get_today_for_user(user_id, language_id, day=day, session=session)
        entry.streak_day, entry.current_streak_length = True, length
        db_manager.modify(obj=entry, session=session, commit=False)
        return entry

    def update(
        self,
        progress_tracking_id: str,
        session: Session,
        day: Optional[date] = None,
    ) -> DailyStats:
        """Count a progress tracking entry on the learner's day: items, correct, time. Time never validates a day."""
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
            day=day,
            session=session,
        )
        daily_stats.items_reviewed += 1
        if progress_tracking.result is True:
            daily_stats.items_correct += 1
        daily_stats.time_studied_ms += int(progress_tracking.duration_ms)
        result = db_manager.modify(obj=daily_stats, session=session, commit=False)
        if result is None:
            raise RuntimeError(f"Failed to update daily stats entry for progress tracking {progress_tracking_id}")
        return result
