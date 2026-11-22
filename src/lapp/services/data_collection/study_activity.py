"""One explicit step per answer: progress row -> daily stats -> commitment log -> learner day (audit D10b).

The streak is per learner across every language: a day validates when the learner gives `streak_min_answers` real
answers (default 20) or finishes the queue; "day" is the learner's own calendar day (DM-22, DM-37, DM-61). Time is not
a streak input. Replaces the chain that `ProgressTrackingService.create` used to trigger."""
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Optional

from flask import g, has_request_context

from sqlalchemy.orm import Session

from ...core.database import db_manager, transactional
from ...models.data_collection import CommitmentLog, LearnerDay, ProgressTracking
from ...schemas.data_collection.progress_tracking import ProgressTrackingDict
from ...utils.learner_clock import learner_today
from ..system_data.prefs_view import prefs_for
from .commitment_log import CommitmentLogService
from .daily_stats import DailyStatsService

daily_stats_service = DailyStatsService()
commitment_log_service = CommitmentLogService()


@dataclass
class DayStatus:
    day: date
    answers: int
    validated: bool
    streak: int                 # length of the streak that includes the day (yesterday's while today is not yet validated)
    just_validated: bool = False


def day_row(user_id: str, day: date, session: Session, create: bool = False) -> Optional[LearnerDay]:
    row = session.query(LearnerDay).filter_by(user_id=user_id, day=day).first()
    if row is None and create:
        row = LearnerDay(id=db_manager.generate_new_id(LearnerDay, session=session), user_id=user_id, day=day)
        session.add(row)
        session.flush()
    return row


def status_for(user_id: str, day: date, session: Session) -> DayStatus:
    """The learner's streak state on `day`. An unvalidated day shows the streak still alive from yesterday."""
    today = day_row(user_id, day, session)
    if today is not None and today.validated:
        return DayStatus(day, today.answers, True, today.streak_length)
    yesterday = day_row(user_id, day - timedelta(days=1), session)
    return DayStatus(day, today.answers if today else 0, False, yesterday.streak_length if yesterday and yesterday.validated else 0)


def review_session_id() -> Optional[str]:
    """The review session the current request belongs to (header `X-Review-Session`, set by the client), if any."""
    return getattr(g, "review_session_id", None) if has_request_context() else None


def review_card_id() -> Optional[str]:
    """The card being credited (an exercise sets it so the rows it writes for its elements count as one card)."""
    return getattr(g, "review_card_id", None) if has_request_context() else None


class StudyActivity:
    @transactional
    def record(self, user_id: str, language_id: str, answer: ProgressTrackingDict, tz: Optional[str] = None,
               session: Optional[Session] = None) -> DayStatus:
        """Store one answer and everything it feeds. `tz` defaults to the learner's stored zone."""
        prefs = prefs_for(user_id, language_id, session)
        day = learner_today(tz or prefs.timezone)
        row = day_row(user_id, day, session, create=True)
        entry = ProgressTracking(
            id=db_manager.generate_new_id(model_class=ProgressTracking, session=session),
            user_id=user_id, language_id=language_id, element_id=answer.element_id, element_type=answer.element_type,
            element_status=answer.element_status, score_before=answer.score_before, score_after=answer.score_after,
            result=answer.result, duration_ms=answer.duration_ms, hint_used=answer.hint_used, attempt_number=answer.attempt_number,
            daily_goal_reached_before=row.validated, difficulty_before=answer.difficulty_before, difficulty_after=answer.difficulty_after,
            session_id=review_session_id(), card_id=review_card_id() or answer.element_id)
        db_manager.insert(obj=entry, session=session, commit=False)
        daily_stats_service.update(progress_tracking_id=entry.id, day=day, session=session)
        commitment_log_service.apply_progress_tracking(progress_tracking_id=entry.id, day=day, session=session)
        row.answers += 1
        just = False
        if not row.validated and row.answers >= prefs.streak_min_answers:
            just = self._validate(user_id, language_id, row, session)
        status = status_for(user_id, day, session)
        status.just_validated = just
        return status

    @transactional
    def complete_queue(self, user_id: str, language_id: str, tz: Optional[str] = None, session: Optional[Session] = None) -> DayStatus:
        """The queue was finished: the day validates too, provided the learner answered at least once today."""
        day = learner_today(tz or prefs_for(user_id, language_id, session).timezone)
        row = day_row(user_id, day, session)
        just = False
        if row is not None and not row.validated and row.answers >= 1:
            just = self._validate(user_id, language_id, row, session)
        status = status_for(user_id, day, session)
        status.just_validated = just
        return status

    @staticmethod
    def _validate(user_id: str, language_id: str, row: LearnerDay, session: Session) -> bool:
        """Mark the learner's day a streak day (once) and carry the length into the language rows and the logs."""
        previous = day_row(user_id, row.day - timedelta(days=1), session)
        row.validated = True
        row.streak_length = previous.streak_length + 1 if previous and previous.validated else 1
        session.flush()
        daily_stats_service.mark_streak_day(user_id, language_id, row.day, row.streak_length, session=session)
        for log in session.query(CommitmentLog).filter_by(user_id=user_id).all():     # longest streak is the learner's, not a language's
            if row.streak_length > (log.longest_streak_ever or 0):
                log.longest_streak_ever = row.streak_length
            log.streak_last_computed_at = datetime.now().isoformat()
        session.flush()
        return True
