"""Study preference columns, validators and the preferred-types migration."""
import importlib.util
from pathlib import Path

import pytest
from pydantic import ValidationError
from sqlalchemy import text

from lapp.models.system_data import User, ExerciseUserPref
from lapp.schemas.system_data.user_preferences import UserPreferencesDict
from lapp.services.system_data import UserPreferencesService

_spec = importlib.util.spec_from_file_location(
    "mig2", Path(__file__).parent.parent / "alembic/versions/d2b8f5e0c3a7_study_preferences.py")
mig = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mig)


@pytest.mark.parametrize("field,value", [
    ("voc_side_pattern", {"mode": "random", "front": 3, "back": 1}),
    ("voc_side_pattern", {"mode": "cycle", "cycle": ["F", "F", "B"]}),
    ("voc_side_pattern", {"mode": "split"}),
    ("exercise_type_prefs", {"essay": "ban", "quizz": "boost"}),
    ("review_layout", [{"type": "voc", "minutes": None}, {"type": "gram", "minutes": 5}]),
])
def test_valid(field, value):
    assert getattr(UserPreferencesDict(**{field: value}), field) == value


@pytest.mark.parametrize("field,value", [
    ("voc_side_pattern", {"mode": "cycle", "cycle": ["F", "X"]}),
    ("voc_side_pattern", {"mode": "cycle", "cycle": []}),
    ("voc_side_pattern", {"mode": "random", "front": 0, "back": 0}),
    ("voc_side_pattern", {"mode": "nope"}),
    ("exercise_type_prefs", {"essay": "love"}),
    ("exercise_type_prefs", {"nonsense": "ban"}),
    ("review_layout", [{"type": "voc"}, {"type": "voc"}]),
    ("review_layout", [{"type": "x"}]),
    ("review_layout", []),
    ("review_layout", [{"type": "voc", "minutes": 0}]),
])
def test_invalid(field, value):
    with pytest.raises(ValidationError):
        UserPreferencesDict(**{field: value})


def _user(db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)


def test_round_trip(db):
    _user(db)
    data = UserPreferencesDict(user_id="user_U1", voc_side_pattern={"mode": "split"},
                               exercise_type_prefs={"essay": "ban"}, review_layout=[{"type": "ex", "minutes": None}])
    out = UserPreferencesService().create(data, as_dict=True)
    assert out["voc_side_pattern"] == {"mode": "split"} and out["exercise_type_prefs"] == {"essay": "ban"}
    upd = UserPreferencesService().update(out["id"], UserPreferencesDict(review_layout=[{"type": "voc", "minutes": 3}]), as_dict=True)
    assert upd["review_layout"] == [{"type": "voc", "minutes": 3}] and upd["exercise_type_prefs"] == {"essay": "ban"}


def test_unique_user_exercise(db):
    _user(db)
    with db.session_scope() as s:
        db.insert(ExerciseUserPref(id="xup_X1", user_id="user_U1", exercise_id="ex_E1", mode="ban"), session=s, commit=False)
    with db.session_scope() as s:   # db.insert reports an integrity error instead of raising
        db.insert(ExerciseUserPref(id="xup_X2", user_id="user_U1", exercise_id="ex_E1", mode="boost"), session=s, commit=False)
    with db.session_scope() as s:
        assert [r.id for r in s.query(ExerciseUserPref)] == ["xup_X1"]


def test_migrate_preferred_types(db):
    _user(db)
    with db.engine.begin() as conn:
        conn.execute(text("ALTER TABLE user_preferences ADD COLUMN preferred_exercise_types JSON"))
        conn.execute(text("INSERT INTO user_preferences (id, user_id, native_language_iso639_2, daily_goal_minutes, "
                          "ai_feedback_enabled, ai_learnable_sentence_enabled, ai_example_sentence_enabled, ai_example_word_enabled, "
                          "ai_tts_enabled, exercise_type_prefs, preferred_exercise_types) VALUES "
                          "('pref_P1','user_U1','[\"eng\"]',20,true,true,true,true,true,'{}','[\"essay\"]')"))
        mig.migrate_preferred_types(conn)
        got = conn.execute(text("SELECT exercise_type_prefs FROM user_preferences")).scalar_one()
    assert got == {"essay": "boost"}
