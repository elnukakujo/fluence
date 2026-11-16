"""Weekly snapshots (DM-47): per language, the level counts when a week closed (Sunday 23:59 learner time).

Written by the scheduler and lazily by `catch_up` on the first visit after a boundary, so a server that was down over a
week boundary never loses it. `close_week` is idempotent."""
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from ...core.database import db_manager, transactional
from ...models.containers import Language, Lesson
from ...models.data_collection import WeeklySnapshot
from ...models.features import Calligraphy, Grammar, Vocabulary
from ...models.system_data import StudyGoal, StudyGoalItem
from ...utils.learner_clock import learner_today, week_bounds, week_closed_at
from ...utils.scoring import KNOWN_FROM, MASTERED_FROM
from ..system_data import ScoreService

MAX_CATCH_UP_WEEKS = 104        # an account idle for longer than two years gets the last two years of weeks, no more


class WeeklySnapshotService:
    @transactional
    def close_week(self, user_id: str, language_id: str, week_start: date, tz: Optional[str] = None,
                   session: Optional[Session] = None) -> WeeklySnapshot:
        row = session.query(WeeklySnapshot).filter_by(user_id=user_id, language_id=language_id, week_start=week_start).first()
        if row is not None:
            return row
        ids = [i for model in (Vocabulary, Grammar, Calligraphy)
               for (i,) in session.query(model.id).join(Lesson, Lesson.id == model.lesson_id).filter(Lesson.language_id == language_id)]
        closed = week_closed_at(tz, week_start).astimezone().replace(tzinfo=None)         # scores are stored in server local time
        scores = ScoreService().get_many(user_id, ids, now=min(closed, datetime.now()), session=session)
        by = [r.score or 0.0 for r in scores.values()]
        succeeded = {i for (i,) in session.query(StudyGoalItem.element_id).join(StudyGoal, StudyGoal.id == StudyGoalItem.goal_id).filter(
            StudyGoal.user_id == user_id, StudyGoal.language_id == language_id, StudyGoalItem.succeeded_at.isnot(None))}
        row = WeeklySnapshot(
            id=db_manager.generate_new_id(WeeklySnapshot, session=session), user_id=user_id, language_id=language_id, week_start=week_start,
            n_learning=sum(1 for s in by if s < KNOWN_FROM), n_known=sum(1 for s in by if KNOWN_FROM <= s < MASTERED_FROM),
            n_mastered=sum(1 for s in by if s >= MASTERED_FROM), n_seen=len(by), n_total=len(ids),
            n_fading=sum(1 for i in succeeded if i in scores and (scores[i].score or 0.0) < KNOWN_FROM))
        session.add(row)
        session.flush()
        return row

    @transactional
    def catch_up(self, user_id: str, tz: Optional[str] = None, now: Optional[datetime] = None,
                 session: Optional[Session] = None) -> list[WeeklySnapshot]:
        """Write every closed week that has no snapshot yet, per language (only the last closed week when a language has none at all)."""
        now = now or datetime.now(timezone.utc)
        this_week = week_bounds(tz, learner_today(tz, now))[0]
        last_closed = this_week if week_closed_at(tz, this_week) <= now.astimezone(week_closed_at(tz, this_week).tzinfo) else this_week - timedelta(days=7)
        written = []
        for (language_id,) in session.query(Language.id).filter(Language.user_id == user_id).all():
            latest = session.query(WeeklySnapshot.week_start).filter_by(user_id=user_id, language_id=language_id) \
                .order_by(WeeklySnapshot.week_start.desc()).first()
            start = max(latest[0] + timedelta(days=7), last_closed - timedelta(weeks=MAX_CATCH_UP_WEEKS)) if latest else last_closed
            week = start
            while week <= last_closed:
                if session.query(WeeklySnapshot).filter_by(user_id=user_id, language_id=language_id, week_start=week).first() is None:
                    written.append(self.close_week(user_id, language_id, week, tz, session=session))
                week += timedelta(days=7)
        return written
