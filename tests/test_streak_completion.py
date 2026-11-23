"""Finishing the daily review validates the day for the streak, once per day.

Run: `uv run pytest tests/test_streak_completion.py`
"""
from datetime import datetime, timedelta

from lapp.models.containers.language import Language
from lapp.models.data_collection import LearnerDay
from lapp.utils.learner_clock import learner_today
from lapp.models.system_data import User
from lapp.services.auth import AuthService
from lapp.services.data_collection.commitment_log import CommitmentLogService
from lapp.schemas.data_collection.progress_tracking import ProgressTrackingDict
from lapp.services.data_collection.daily_stats import DailyStatsService
from lapp.services.data_collection.study_activity import StudyActivity

stats = DailyStatsService()


def _seed(db):
    with db.session_scope() as s:
        db.insert(User(id="user_S1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_S1", user_id="user_S1", name="J"), session=s, commit=False)


def _validate():
    """One answer today, then the finished queue: the way a day becomes a streak day."""
    StudyActivity().record("user_S1", "lang_S1", ProgressTrackingDict(
        element_id="voc_1", element_type="vocabulary", element_status="learning", score_before=0.0, score_after=10.0, result=True, duration_ms=1000.0), tz="UTC")
    StudyActivity().complete_queue("user_S1", "lang_S1", tz="UTC")


def _today(): return stats.get_today_for_user("user_S1", "lang_S1", as_dict=True)
def _longest(): return CommitmentLogService().get_for_user("user_S1", "lang_S1", as_dict=True)["longest_streak_ever"]


def test_validate_day_sets_streak_and_log(db):
    _seed(db)
    _validate()
    t = _today()
    assert t["streak_day"] is True and t["current_streak_length"] == 1 and _longest() == 1


def test_validate_day_twice_is_idempotent(db):
    _seed(db)
    _validate()
    _validate()
    assert _today()["current_streak_length"] == 1 and _longest() == 1


def test_streak_continues_from_yesterday(db):
    _seed(db)
    with db.session_scope() as s:
        db.insert(LearnerDay(id="day_Y", user_id="user_S1", day=learner_today("UTC") - timedelta(days=1), answers=20, validated=True, streak_length=3),
                  session=s, commit=False)
    _validate()
    assert _today()["current_streak_length"] == 4


def test_route_validates_only_after_an_answer(app, db):
    _seed(db)
    c = app.test_client()
    c.set_cookie('session_token', AuthService().create_session("user_S1", remember=False))
    assert c.post('/api/review/lang_S1/complete', json={}, headers={"X-Timezone": "UTC"}).get_json() == {"streak": 0, "validated": False, "just_validated": False}
    StudyActivity().record("user_S1", "lang_S1", ProgressTrackingDict(
        element_id="voc_1", element_type="vocabulary", element_status="learning", score_before=0.0, score_after=10.0, result=True, duration_ms=1000.0), tz="UTC")
    assert c.post('/api/review/lang_S1/complete', json={}, headers={"X-Timezone": "UTC"}).get_json() == {"streak": 1, "validated": True, "just_validated": True}
    assert c.post('/api/review/lang_S1/complete', json={}, headers={"X-Timezone": "UTC"}).get_json() == {"streak": 1, "validated": True, "just_validated": False}
    assert _longest() == 1
