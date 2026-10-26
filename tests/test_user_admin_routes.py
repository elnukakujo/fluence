"""User routes (self vs admin) + block/unblock tests (Task 10 + 11)."""
from werkzeug.security import generate_password_hash, check_password_hash

from lapp.services.auth import AuthService
from lapp.models.system_data import User


def _user_with_session(db, uid, username, email, **kwargs):
    with db.session_scope() as s:
        db.insert(User(id=uid, username=username, email=email, **kwargs), session=s, commit=False)
    return AuthService().create_session(uid, remember=False)


def test_nonadmin_cannot_list_users(app, db):
    token_b = _user_with_session(db, "user_U2", "b", "b@x.com")
    client = app.test_client()
    client.set_cookie('session_token', token_b)
    assert client.get('/api/user/').status_code == 403


def test_public_signup_creates_nonadmin_user(app, db):
    # An existing admin means this is a "subsequent" signup, not the bootstrap.
    _user_with_session(db, "user_U1", "a", "a@x.com", is_admin=True)
    client = app.test_client()
    res = client.post('/api/user/', json={"username": "newbie", "email": "new@x.com", "password": "pw"})
    assert res.status_code == 201
    assert res.get_json()['user']['is_admin'] is False
    assert res.get_json()['user']['approved'] is False


def test_pending_user_cannot_login(app, db):
    _user_with_session(db, "user_U1", "a", "a@x.com", is_admin=True)
    client = app.test_client()
    client.post('/api/user/', json={"username": "newbie", "email": "new@x.com", "password": "pw"})
    res = client.post('/api/auth/login', json={'email': 'new@x.com', 'password': 'pw'})
    assert res.status_code == 403
    assert res.get_json()['error'] == 'account_pending'


def test_admin_can_approve_user(app, db):
    token_a = _user_with_session(db, "user_U1", "a", "a@x.com", is_admin=True)
    client = app.test_client()
    client.post('/api/user/', json={"username": "newbie", "email": "new@x.com", "password": "pw"})
    with db.session_scope() as s:
        newbie = db.find_by_attr(User, {"email": "new@x.com"}, session=s)
    # Approve as admin
    client.set_cookie('session_token', token_a)
    assert client.put(f'/api/user/{newbie.id}/approve', json={"approved": True}).status_code == 200
    # Now login works
    res = client.post('/api/auth/login', json={'email': 'new@x.com', 'password': 'pw'})
    assert res.status_code == 200


def test_admin_can_list_users(app, db):
    token_a = _user_with_session(db, "user_U1", "a", "a@x.com", is_admin=True)
    _user_with_session(db, "user_U2", "b", "b@x.com")
    client = app.test_client()
    client.set_cookie('session_token', token_a)
    res = client.get('/api/user/')
    assert res.status_code == 200
    assert len(res.get_json()) == 2


def test_user_can_update_self_but_not_other(app, db):
    token_a = _user_with_session(db, "user_U1", "a", "a@x.com")
    _user_with_session(db, "user_U2", "b", "b@x.com")
    client = app.test_client()
    client.set_cookie('session_token', token_a)
    assert client.put('/api/user/user_U1', json={"display_name": "A"}).status_code == 200
    assert client.put('/api/user/user_U2', json={"display_name": "hacked"}).status_code == 403


def test_admin_can_block_user(app, db):
    token_a = _user_with_session(db, "user_U1", "a", "a@x.com", is_admin=True)
    _user_with_session(db, "user_U2", "b", "b@x.com")
    client = app.test_client()
    client.set_cookie('session_token', token_a)
    res = client.put('/api/user/user_U2/block', json={"blocked": True})
    assert res.status_code == 200
    with db.session_scope() as s:
        u = db.find_by_attr(User, {"id": "user_U2"}, session=s)
        assert u.blocked is True


def test_nonadmin_cannot_block(app, db):
    _user_with_session(db, "user_U1", "a", "a@x.com")
    token_b = _user_with_session(db, "user_U2", "b", "b@x.com")
    client = app.test_client()
    client.set_cookie('session_token', token_b)
    assert client.put('/api/user/user_U1/block', json={"blocked": True}).status_code == 403


def test_password_set_flow(app, db):
    # passwordless user (first-login set) vs user with an existing password
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
    with db.session_scope() as s:
        db.insert(User(id="user_U2", username="b", email="b@x.com", password_hash=generate_password_hash("pw")), session=s, commit=False)

    client = app.test_client()
    # passwordless → allowed without a session
    assert client.put('/api/user/user_U1/password', json={"password": "newpw"}).status_code == 200
    # has a password → requires auth (403 when unauthenticated)
    assert client.put('/api/user/user_U2/password', json={"password": "hack"}).status_code == 403

    with db.session_scope() as s:
        u = db.find_by_attr(User, {"id": "user_U1"}, session=s)
        assert check_password_hash(u.password_hash, "newpw")


def test_delete_user_cascades(db):
    from lapp.models.containers import Language, Lesson
    from lapp.models.components import Word
    from lapp.models.features import Vocabulary
    from lapp.models.system_data import Tag, UserSession
    from lapp.services.system_data import UserService
    from lapp.core.database import db_manager

    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id="user_U1", name="Japanese"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", language_id="lang_L1", user_id="user_U1", title="L1"), session=s, commit=False)
        db.insert(Word(id="word_W1", language_id="lang_L1", word="猫"), session=s, commit=False)
        db.insert(Vocabulary(id="voc_V1", lesson_id="lesson_L1", word_id="word_W1"), session=s, commit=False)
        db.insert(Tag(id="tag_T1", user_id="user_U1", name="N5"), session=s, commit=False)
    AuthService().create_session("user_U1", remember=False)

    assert UserService().delete("user_U1") is True

    with db.session_scope() as s:
        assert db.find_by_attr(User, {"id": "user_U1"}, session=s) is None
        assert db_manager.find_all(Language, filters={"user_id": "user_U1"}, session=s) == []
        assert db_manager.find_all(Lesson, filters={"language_id": "lang_L1"}, session=s) == []
        assert db_manager.find_all(Word, filters={"language_id": "lang_L1"}, session=s) == []
        assert db_manager.find_all(Vocabulary, filters={"lesson_id": "lesson_L1"}, session=s) == []
        assert db_manager.find_all(Tag, filters={"user_id": "user_U1"}, session=s) == []
        assert db_manager.find_all(UserSession, filters={"user_id": "user_U1"}, session=s) == []
