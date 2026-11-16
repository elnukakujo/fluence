from datetime import date, datetime

from ...utils.learner_clock import learner_today
from typing import Optional

import logging
logger = logging.getLogger(__name__)
from sqlalchemy.orm import Session

from ...core.database import db_manager, transactional
from ...models.data_collection import CommitmentLog, DailyStats, ProgressTracking

class CommitmentLogService:
    def _serialize(
        self,
        entry: CommitmentLog | None,
        as_dict: bool,
        include_relations: bool,
    ) -> CommitmentLog | dict | None:
        if not as_dict or entry is None:
            return entry
        return entry.to_dict(include_relations=include_relations)

    def _serialize_list(
        self,
        entries: list[CommitmentLog],
        as_dict: bool,
        include_relations: bool,
    ) -> list[CommitmentLog] | list[dict]:
        if not as_dict:
            return entries
        return [entry.to_dict(include_relations=include_relations) for entry in entries]

    @transactional
    def get_by_id(
        self,
        commitment_log_id: str,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True,
    ) -> CommitmentLog | dict | None:
        entry = db_manager.find_by_attr(
            model_class=CommitmentLog,
            attr_values={"id": commitment_log_id},
            session=session,
        )
        return self._serialize(entry, as_dict, include_relations)

    @transactional
    def get_for_user(
        self,
        user_id: str,
        language_id: str,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True,
    ) -> CommitmentLog | dict | None:
        """Return single CommitmentLog for (user_id, language_id) or None."""
        entry = (
            session.query(CommitmentLog)
            .filter(
                CommitmentLog.user_id == user_id,
                CommitmentLog.language_id == language_id,
            )
            .order_by(CommitmentLog.created_at.desc())
            .first()
        )
        return self._serialize(entry, as_dict, include_relations)

    @transactional
    def get_all_for_user(
        self,
        user_id: str,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True,
    ) -> list[CommitmentLog] | list[dict]:
        entries = (
            session.query(CommitmentLog)
            .filter(CommitmentLog.user_id == user_id)
            .order_by(CommitmentLog.language_id)
            .all()
        )
        return self._serialize_list(entries, as_dict, include_relations)

    def create(
        self,
        user_id: str,
        language_id: str,
        session: Session,
    ) -> CommitmentLog:
        entry = CommitmentLog(
            id=db_manager.generate_new_id(model_class=CommitmentLog, session=session),
            user_id=user_id,
            language_id=language_id,
            days_active=0,
            total_items_reviewed=0,
            total_time_ms=0,
            longest_streak_ever=0,
            streak_last_computed_at="",
            days_active_last_counted_at="",
        )
        result = db_manager.insert(obj=entry, session=session, commit=False)
        if result is None:
            raise RuntimeError("Failed to create commitment log entry")
        return result
    
    def apply_progress_tracking(
        self,
        progress_tracking_id: str,
        session: Session,
        day: Optional[date] = None,
    ) -> CommitmentLog:
        """Append-only update invoked for every answer, on the learner's day.

        Caller MUST pass an open session.
        """
        try:
            progress_tracking = db_manager.find_by_attr(
                model_class=ProgressTracking,
                attr_values={"id": progress_tracking_id},
                session=session,
            )

            if progress_tracking is None:
                raise ValueError(f"ProgressTracking entry not found: {progress_tracking_id}")

            commitment_log = (
                session.query(CommitmentLog)
                .filter(
                    CommitmentLog.user_id == progress_tracking.user_id,
                    CommitmentLog.language_id == progress_tracking.language_id,
                )
                .order_by(CommitmentLog.created_at.desc())
                .first()
            )

            if commitment_log is None:
                commitment_log = self.create(
                    user_id=progress_tracking.user_id,
                    language_id=progress_tracking.language_id,
                    session=session,
                )

            # Apply append-only aggregation
            today = (day or learner_today(None)).isoformat()      # callers pass the learner day
            if commitment_log.days_active_last_counted_at.split("T")[0] != today: # Only count a new day once
                commitment_log.days_active += 1
                commitment_log.days_active_last_counted_at = today

            commitment_log.total_items_reviewed += 1
            commitment_log.total_time_ms += int(progress_tracking.duration_ms)

            result = db_manager.modify(obj=commitment_log, session=session, commit=False)
            if result is None:
                raise RuntimeError("Failed to persist commitment log update")
            return result
        except Exception as error:
            logger.error(f"Failed to apply progress tracking to commitment log: {error}")
            raise

    def apply_daily_stats(
        self,
        daily_stats_id: str,
        session: Session,
    ) -> CommitmentLog:
        """Append-only update invoked when a day's streak is achieved.

        Caller MUST pass an open session.
        """
        try:
            daily_stats: DailyStats = db_manager.find_by_attr(
                model_class=DailyStats,
                attr_values={"id": daily_stats_id},
                session=session,
            )

            if daily_stats is None:
                raise ValueError(f"DailyStats entry not found: {daily_stats_id}")

            commitment_log = (
                session.query(CommitmentLog)
                .filter(
                    CommitmentLog.user_id == daily_stats.user_id,
                    CommitmentLog.language_id == daily_stats.language_id,
                )
                .order_by(CommitmentLog.created_at.desc())
                .first()
            )

            if commitment_log is None:
                commitment_log = self.create(
                    user_id=daily_stats.user_id,
                    language_id=daily_stats.language_id,
                    session=session,
                )

            # Apply append-only aggregation
            if (daily_stats.current_streak_length or 0) > (commitment_log.longest_streak_ever or 0):
                commitment_log.longest_streak_ever = int(daily_stats.current_streak_length)
            commitment_log.streak_last_computed_at = datetime.now().isoformat()

            result = db_manager.modify(obj=commitment_log, session=session, commit=False)
            if result is None:
                raise RuntimeError("Failed to persist commitment log update")
            return result
        except Exception as error:
            logger.error(f"Failed to apply daily stats to commitment log: {error}")
            raise