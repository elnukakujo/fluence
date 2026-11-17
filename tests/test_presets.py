"""Presets set exactly the three pace numbers and leave skills and every other group alone."""
import pytest

from lapp.services.system_data.presets import PRESETS
from test_settings_groups import _client, _get, _put


def test_values_are_exactly_the_listed_ones():
    assert PRESETS == {"casual": {"new_per_week": 5, "reviews_per_day": 20, "streak_min_answers": 10},
                       "standard": {"new_per_week": 15, "reviews_per_day": 40, "streak_min_answers": 20},
                       "intensive": {"new_per_week": 30, "reviews_per_day": 80, "streak_min_answers": 40}}


@pytest.mark.parametrize("name", list(PRESETS))
def test_apply_sets_pace_only(app, db, name):
    c = _client(app, db)
    _put(c, "skills", {"enabled_skills": {"Vocabulary": ["recall"]}})
    _put(c, "answer", {"hints_enabled": False})
    _put(c, "pace", {"daily_goal_minutes": 45})
    pace = c.post("/api/pref/preset", json={"name": name}).get_json()["values"]
    assert {k: pace[k] for k in PRESETS[name]} == PRESETS[name] and pace["daily_goal_minutes"] == 45
    assert _get(c, "skills")["values"]["enabled_skills"] == {"Vocabulary": ["recall"]}
    assert _get(c, "answer")["values"]["hints_enabled"] is False


def test_unknown_preset_is_400(app, db):
    assert _client(app, db).post("/api/pref/preset", json={"name": "extreme"}).status_code == 400
