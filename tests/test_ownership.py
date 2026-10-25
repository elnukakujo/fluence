"""Ownership checks on container/feature routes (Task 8)."""
from lapp.services.auth import AuthService
from lapp.models.system_data import User
from lapp.models.containers import Language, Lesson


def _user_with_session(db, uid, username, email):
    with db.session_scope() as s:
        db.insert(User(id=uid, username=username, email=email), session=s, commit=False)
    return AuthService().create_session(uid, remember=False)


def _make_language(db, lang_id, user_id):
    with db.session_scope() as s:
        db.insert(Language(id=lang_id, user_id=user_id, name="Japanese"), session=s, commit=False)


def _make_lesson(db, lesson_id, language_id, user_id):
    with db.session_scope() as s:
        db.insert(Lesson(id=lesson_id, language_id=language_id, user_id=user_id, title="L1"), session=s, commit=False)


def test_cannot_get_others_language(app, db):
    _user_with_session(db, "user_U1", "a", "a@x.com")
    token_b = _user_with_session(db, "user_U2", "b", "b@x.com")
    _make_language(db, "lang_L1", "user_U1")

    client = app.test_client()
    client.set_cookie('session_token', token_b)
    assert client.get('/api/languages/lang_L1').status_code == 403


def test_cannot_update_others_lesson(app, db):
    _user_with_session(db, "user_U1", "a", "a@x.com")
    token_b = _user_with_session(db, "user_U2", "b", "b@x.com")
    _make_language(db, "lang_L1", "user_U1")
    _make_lesson(db, "lesson_L1", "lang_L1", "user_U1")

    client = app.test_client()
    client.set_cookie('session_token', token_b)
    assert client.put('/api/lessons/lesson_L1', json={"title": "hacked"}).status_code == 403


def test_create_forces_owner(app, db):
    _user_with_session(db, "user_U1", "a", "a@x.com")
    token_b = _user_with_session(db, "user_U2", "b", "b@x.com")

    client = app.test_client()
    client.set_cookie('session_token', token_b)
    res = client.post('/api/languages/', json={"name": "French", "user_id": "user_U1", "target_iso639_2t": "fra"})
    assert res.status_code == 201
    assert res.get_json()['language']['user_id'] == 'user_U2'  # forced to caller
