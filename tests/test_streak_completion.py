"""Finishing the daily review validates the day for the streak, once per day.

Run: `uv run pytest tests/test_streak_completion.py`
"""
from datetime import datetime, timedelta

from lapp.models.containers.language import Language
from lapp.models.data_collection.daily_stats import DailyStats
from lapp.models.system_data import User
from lapp.services.auth import AuthService
from lapp.services.data_collection.commitment_log import CommitmentLogService
from lapp.services.data_collection.daily_stats import DailyStatsService

stats = DailyStatsService()


def _seed(db):
    with db.session_scope() as s:
        db.insert(User(id="user_S1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_S1", user_id="user_S1", name="J"), session=s, commit=False)


def _today(): return stats.get_today_for_user("user_S1", "lang_S1", as_dict=True)
def _longest(): return CommitmentLogService().get_for_user("user_S1", "lang_S1", as_dict=True)["longest_streak_ever"]


def test_validate_day_sets_streak_and_log(db):
    _seed(db)
    stats.validate_day("user_S1", "lang_S1")
    t = _today()
    assert t["streak_day"] is True and t["current_streak_length"] == 1 and _longest() == 1


def test_validate_day_twice_is_idempotent(db):
    _seed(db)
    stats.validate_day("user_S1", "lang_S1")
    stats.validate_day("user_S1", "lang_S1")
    assert _today()["current_streak_length"] == 1 and _longest() == 1


def test_streak_continues_from_yesterday(db):
    _seed(db)
    with db.session_scope() as s:
        db.insert(DailyStats(id="daily_Y", user_id="user_S1", language_id="lang_S1", items_reviewed=1, items_correct=1,
                             time_studied_ms=0, streak_day=True, current_streak_length=3,
                             created_at=datetime.now() - timedelta(days=1)), session=s, commit=False)
    stats.validate_day("user_S1", "lang_S1")
    assert _today()["current_streak_length"] == 4


def test_route_zero_cards_does_not_validate_and_cards_do(app, db):
    _seed(db)
    c = app.test_client()
    c.set_cookie('session_token', AuthService().create_session("user_S1", remember=False))
    assert c.post('/api/review/lang_S1/complete', json={"cards": 0}).get_json() == {"streak": 0, "validated": False}
    assert c.post('/api/review/lang_S1/complete', json={"cards": 5}).get_json() == {"streak": 1, "validated": True}
    assert c.post('/api/review/lang_S1/complete', json={"cards": 5}).get_json() == {"streak": 1, "validated": True}
    assert _longest() == 1
