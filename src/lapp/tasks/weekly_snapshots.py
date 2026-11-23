import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from flask import Flask

from ..core.database import db_manager
from ..models.system_data import User
from ..services.data_collection.weekly_snapshot import WeeklySnapshotService
from ..services.system_data.prefs_view import prefs_for

logger = logging.getLogger(__name__)


def register_weekly_snapshot_tasks(scheduler: BackgroundScheduler, app: Flask):
    """Close every learner's finished weeks (also once at startup, so an outage over a boundary is made up). Idempotent."""
    scheduler.add_job(func=close_weeks, id='weekly_snapshots_startup', name='Weekly snapshots (startup)', replace_existing=True, args=[app])
    scheduler.add_job(func=close_weeks, trigger=IntervalTrigger(hours=6), id='weekly_snapshots', name='Weekly snapshots',
                      replace_existing=True, args=[app])


def close_weeks(app: Flask) -> int:
    written = 0
    with app.app_context():
        with db_manager.session_scope() as session:
            user_ids = [uid for (uid,) in session.query(User.id).all()]
        for user_id in user_ids:   # one session per learner: one bad account must not roll back or block the others
            try:
                with db_manager.session_scope() as session:
                    written += len(WeeklySnapshotService().catch_up(user_id, prefs_for(user_id, session=session).timezone, session=session))
            except Exception:
                logger.exception("Weekly snapshots failed for user %s", user_id)
    if written:
        logger.info("Wrote %s weekly snapshot(s)", written)
    return written
