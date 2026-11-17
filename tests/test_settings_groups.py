"""Settings groups: defaults, course over account, one group at a time, validation."""
import lapp.services  # noqa: F401
from lapp.models.containers import Language
from lapp.models.system_data import User
from lapp.services.auth import AuthService


def _client(app, db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="u", email="u@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id="user_U1", name="French", iso1="fr", target_iso639_2t="fra"), session=s, commit=False)
    c = app.test_client()
    c.set_cookie("session_token", AuthService().create_session("user_U1", remember=False))
    assert c.post("/api/pref/", json={"user_id": "user_U1"}).status_code == 201
    return c


def _get(c, group, **q):
    return c.get(f"/api/pref/settings/{group}", query_string=q).get_json()


def _put(c, group, values, **extra):
    return c.put(f"/api/pref/settings/{group}", json={"values": values, **extra})


def test_defaults_without_stored_values(app, db):
    c = _client(app, db)
    assert _get(c, "pace")["values"] == {"daily_goal_minutes": 20, "streak_min_answers": 20, "new_per_week": 15,
                                          "reviews_per_day": 40, "weekly_goals_on": True, "soft_gate": True}
    see = _get(c, "see")["values"]
    assert (see["show_scores"], see["theme"], see["interface_language"], see["show_phonetics"]) == (False, "system", None, "after_reveal")
    assert _get(c, "answer")["values"]["audio_autoplay"] is False and _get(c, "answer")["values"]["hints_enabled"] is True


def test_course_overrides_account_and_null_inherits(app, db):
    c = _client(app, db)
    assert _put(c, "see", {"show_phonetics": "never"}).status_code == 400            # course key without a language
    assert _put(c, "see", {"show_phonetics": "never"}, language_id="lang_L1").status_code == 200
    assert _get(c, "see", language_id="lang_L1")["values"]["show_phonetics"] == "never"
    assert _get(c, "see")["values"]["show_phonetics"] == "after_reveal"               # another view: the default
    _put(c, "see", {"show_phonetics": None}, language_id="lang_L1")
    assert _get(c, "see", language_id="lang_L1")["values"]["show_phonetics"] == "after_reveal"


def test_updating_one_group_leaves_the_others(app, db):
    c = _client(app, db)
    _put(c, "pace", {"daily_goal_minutes": 35, "streak_min_answers": 12})
    assert _put(c, "answer", {"hints_enabled": False}).status_code == 200
    pace = _get(c, "pace")["values"]
    assert (pace["daily_goal_minutes"], pace["streak_min_answers"]) == (35, 12)
    assert _put(c, "answer", {"theme": "dark"}).status_code == 400                    # a key of another group is refused


def test_invalid_values_change_nothing(app, db):
    c = _client(app, db)
    assert _put(c, "pace", {"daily_goal_minutes": 33, "streak_min_answers": 5}).status_code == 400
    assert _get(c, "pace")["values"]["streak_min_answers"] == 20
    assert _put(c, "see", {"theme": "pink"}).status_code == 400
    assert _put(c, "see", {"interface_language": "xx"}).status_code == 400
    assert _put(c, "see", {"interface_language": "fr"}).status_code == 200


def test_skills_are_validated_per_kind(app, db):
    c = _client(app, db)
    assert _put(c, "skills", {"enabled_skills": {"Vocabulary": ["recall"]}}).status_code == 200
    assert _get(c, "skills")["values"]["enabled_skills"] == {"Vocabulary": ["recall"]}
    assert _put(c, "skills", {"enabled_skills": {"Vocabulary": ["dancing"]}}).status_code == 400
    assert _put(c, "skills", {"enabled_skills": {"Vocabulary": []}}).status_code == 400
    assert _put(c, "skills", {"enabled_skills": {"Lesson": ["recall"]}}).status_code == 400


def test_daily_goal_minutes_is_returned_by_the_preferences(app, db):
    c = _client(app, db)
    pref_id = c.get("/api/pref/settings/pace").get_json() and c.post("/api/pref/", json={"user_id": "user_U1"}).get_json()["user_preferences"]["id"]
    assert c.get(f"/api/pref/{pref_id}").get_json()["daily_goal_minutes"] == 20


def test_other_users_course_is_refused(app, db):
    c = _client(app, db)
    with db.session_scope() as s:
        db.insert(User(id="user_U2", username="v", email="v@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L2", user_id="user_U2", name="French", iso1="fr", target_iso639_2t="fra"), session=s, commit=False)
    assert _put(c, "see", {"show_phonetics": "never"}, language_id="lang_L2").status_code == 403
