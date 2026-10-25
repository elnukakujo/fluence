"""User routes (self vs admin) + block/unblock tests (Task 10 + 11)."""
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
