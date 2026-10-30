"""Auth middleware + decorators tests (Task 5)."""
from lapp.services.auth import AuthService
from lapp.models.system_data import User


def _user_and_session(db, **kwargs):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com", **kwargs), session=s, commit=False)
    return AuthService().create_session("user_U1", remember=False)


def test_login_required_401_without_cookie(app, db):
    client = app.test_client()
    assert client.get('/test/protected').status_code == 401


def test_login_required_200_with_cookie(app, db):
    raw = _user_and_session(db)
    client = app.test_client()
    client.set_cookie('session_token', raw)
    assert client.get('/test/protected').status_code == 200


def test_admin_required_403_for_nonadmin(app, db):
    raw = _user_and_session(db)  # non-admin
    client = app.test_client()
    client.set_cookie('session_token', raw)
    assert client.get('/test/admin').status_code == 403


def test_admin_required_200_for_admin(app, db):
    raw = _user_and_session(db, is_admin=True)
    client = app.test_client()
    client.set_cookie('session_token', raw)
    assert client.get('/test/admin').status_code == 200
