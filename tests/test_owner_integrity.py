"""An update never changes who owns a row, and a profile save never resets preferences (audit 2026-11-23)."""
from lapp.models.containers import Language, Lesson
from lapp.models.system_data import Source, Tag, User, UserPreferences
from lapp.services.auth import AuthService


def _login(app, db, uid, **kw):
    with db.session_scope() as s:
        db.insert(User(id=uid, username=uid, email=f"{uid}@x.com", **kw), session=s, commit=False)
    c = app.test_client()
    c.set_cookie("session_token", AuthService().create_session(uid, remember=False))
    return c


def test_tag_and_source_update_keep_their_owner_and_unsent_fields(app, db):
    c = _login(app, db, "user_U1")
    _login(app, db, "user_U2")
    with db.session_scope() as s:
        db.insert(Tag(id="tag_T1", name="old", color="#fff", user_id="user_U1"), session=s, commit=False)
        db.insert(Source(id="src_S1", title="book", source_type="textbook", user_id="user_U1"), session=s, commit=False)
    assert c.put("/api/tags/tag_T1", json={"name": "new", "user_id": "user_U2"}).status_code == 200
    assert c.put("/api/sources/src_S1", json={"title": "novel", "user_id": "user_U2"}).status_code == 200
    with db.session_scope() as s:
        tag, src = s.get(Tag, "tag_T1"), s.get(Source, "src_S1")
        assert (tag.user_id, tag.name, tag.color) == ("user_U1", "new", "#fff")
        assert (src.user_id, src.title, src.source_type) == ("user_U1", "novel", "textbook")


def test_lesson_update_cannot_change_the_owner(app, db):
    c = _login(app, db, "user_U1")
    _login(app, db, "user_U2")
    with db.session_scope() as s:
        db.insert(Language(id="lang_L1", user_id="user_U1", name="l"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="t", position=0), session=s, commit=False)
    c.put("/api/lessons/lesson_L1", json={"title": "x", "language_id": "lang_L1", "user_id": "user_U2"})
    with db.session_scope() as s:
        assert s.get(Lesson, "lesson_L1").user_id == "user_U1"


def test_preferences_update_cannot_move_the_row(app, db):
    c = _login(app, db, "user_U1")
    _login(app, db, "user_U2")
    with db.session_scope() as s:
        db.insert(UserPreferences(id="pref_P1", user_id="user_U1", learning_goals="a"), session=s, commit=False)
    c.put("/api/pref/pref_P1", json={"user_id": "user_U2", "learning_goals": "b"})
    with db.session_scope() as s:
        pref = s.get(UserPreferences, "pref_P1")
        assert (pref.user_id, pref.learning_goals) == ("user_U1", "b")


def test_profile_save_without_preferences_keeps_them(app, db):
    c = _login(app, db, "user_U1")
    with db.session_scope() as s:
        db.insert(UserPreferences(id="pref_P1", user_id="user_U1", learning_goals="keep me", ai_tts_enabled=False),
                  session=s, commit=False)
    assert c.put("/api/user/user_U1", json={"display_name": "Ann"}).status_code == 200
    with db.session_scope() as s:
        pref = s.get(UserPreferences, "pref_P1")
        assert (pref.learning_goals, pref.ai_tts_enabled) == ("keep me", False)


def test_media_delete_is_admin_only_and_private_folders_are_closed(app, db):
    c = _login(app, db, "user_U1")
    assert c.delete("/media/delete/", json={"file_path": "images/a.png"}).status_code == 403
    assert c.get("/media/info/ingestion/job_1/document.json").status_code == 404
    admin = _login(app, db, "user_A", is_admin=True)
    assert admin.delete("/media/delete/", json={"file_path": "ingestion/job_1/document.json"}).status_code == 404
