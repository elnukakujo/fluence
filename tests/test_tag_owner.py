"""Tags and sources on an element are the content owner's: another user's id is not attached (RD-140, CO-15)."""
from lapp.models.containers import Language, Lesson
from lapp.models.system_data import Tag, User
from lapp.services.auth import AuthService


def _login(app, db, uid):
    with db.session_scope() as s:
        db.insert(User(id=uid, username=uid, email=f"{uid}@x.com"), session=s, commit=False)
    c = app.test_client()
    c.set_cookie("session_token", AuthService().create_session(uid, remember=False))
    return c


def _lesson_with_tags(app, db):
    c = _login(app, db, "user_U1")
    _login(app, db, "user_U2")
    with db.session_scope() as s:
        db.insert(Language(id="lang_L1", user_id="user_U1", name="l"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="t", position=0), session=s, commit=False)
        db.insert(Tag(id="tag_T1", name="mine", user_id="user_U1"), session=s, commit=False)
        db.insert(Tag(id="tag_T2", name="theirs", user_id="user_U2"), session=s, commit=False)
    return c


def test_an_element_only_carries_its_owners_tags(app, db):
    """Another user's tag id is not attached, and its name is not read back (a collaborator edits the owner's content)."""
    c = _lesson_with_tags(app, db)
    c.put("/api/lessons/lesson_L1", json={"title": "t", "language_id": "lang_L1", "tags": [{"id": "tag_T1"}, {"id": "tag_T2"}]})
    with db.session_scope() as s:
        assert [t.id for t in s.get(Lesson, "lesson_L1").tags] == ["tag_T1"]
