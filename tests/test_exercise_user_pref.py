import pytest

from lapp.models.system_data import User
from lapp.models.containers import Language, Lesson
from lapp.models.features import Exercise
from lapp.schemas.system_data.user_preferences import UserPreferencesDict
from lapp.services.auth import AuthService
from lapp.services.system_data import ExerciseUserPrefService, UserPreferencesService
from lapp.services.system_data.exercise_user_pref import effective_mode


@pytest.mark.parametrize("type_pref,own,expected", [
    (None, None, None), ("boost", None, "boost"), (None, "boost", "boost"),
    ("ban", None, "ban"), (None, "ban", "ban"), ("ban", "boost", "ban"), ("boost", "ban", "ban"),
])
def test_effective_mode(type_pref, own, expected):
    assert effective_mode({"essay": type_pref} if type_pref else {}, "essay", own) == expected


def _seed(db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(User(id="user_U2", username="b", email="b@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id="user_U1", name="J", target_iso639_2t="jpn"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="L", position=0), session=s, commit=False)
        db.insert(Exercise(id="ex_E1", lesson_id="lesson_L1", exercise_type="quizz", question="q", answer="a"), session=s, commit=False)
        db.insert(Exercise(id="ex_E2", lesson_id="lesson_L1", exercise_type="essay", question="q", answer="a"), session=s, commit=False)


def test_service_set_replace_delete(db):
    _seed(db)
    svc = ExerciseUserPrefService()
    svc.set("user_U1", "ex_E1", "boost")
    svc.set("user_U1", "ex_E1", "ban")
    assert svc.modes_for("user_U1", ["ex_E1", "ex_E2"]) == {"ex_E1": "ban"}
    svc.set("user_U1", "ex_E1", None)
    assert svc.modes_for("user_U1", ["ex_E1"]) == {}
    with pytest.raises(ValueError):
        svc.set("user_U1", "ex_E1", "love")


def test_route_and_payload(app, db):
    _seed(db)
    UserPreferencesService().create(UserPreferencesDict(user_id="user_U1", exercise_type_prefs={"essay": "ban"}))
    c = app.test_client()
    c.set_cookie("session_token", AuthService().create_session("user_U1", remember=False))
    assert c.put("/api/exercise/ex_E1/user-pref", json={"mode": "love"}).status_code == 400
    assert c.put("/api/exercise/ex_E1/user-pref", json={"mode": "boost"}).status_code == 200
    rows = {e["id"]: e for e in c.get("/api/exercise/lesson/lesson_L1").get_json()}
    assert rows["ex_E1"]["user_mode"] == "boost" and rows["ex_E1"]["banned"] is False
    assert rows["ex_E2"]["banned"] is True and rows["ex_E2"]["user_mode"] is None


def test_other_user_cannot_touch_it(app, db):
    _seed(db)
    c = app.test_client()
    c.set_cookie("session_token", AuthService().create_session("user_U2", remember=False))
    assert c.put("/api/exercise/ex_E1/user-pref", json={"mode": "ban"}).status_code == 403
