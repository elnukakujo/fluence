"""Login auth: email+password verification and the passwordless-account prompt."""
from werkzeug.security import generate_password_hash

from lapp.core.database import db_manager
from lapp.models.system_data import User
from lapp.services.system_data import UserService


def _make_user(db, **kwargs):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="alice", email="alice@example.com", **kwargs), session=s, commit=False)


def test_authenticate_success(db):
    _make_user(db, password_hash=generate_password_hash("secret"))
    user, needs_password = UserService().authenticate("alice@example.com", "secret")
    assert needs_password is False
    assert user is not None and user["email"] == "alice@example.com"


def test_authenticate_wrong_password(db):
    _make_user(db, password_hash=generate_password_hash("secret"))
    user, needs_password = UserService().authenticate("alice@example.com", "wrong")
    assert user is None and needs_password is False


def test_authenticate_unknown_email(db):
    user, needs_password = UserService().authenticate("nobody@example.com", "x")
    assert user is None and needs_password is False


def test_authenticate_passwordless_needs_password(db):
    _make_user(db)  # no password_hash
    user, needs_password = UserService().authenticate("alice@example.com", "")
    assert needs_password is True
    assert user is not None and user["id"] == "user_U1"


def test_login_route(app, db):
    _make_user(db, password_hash=generate_password_hash("secret"))
    client = app.test_client()
    res = client.post("/api/user/login", json={"email": "alice@example.com", "password": "secret"})
    assert res.status_code == 200
    assert res.get_json()["user"]["email"] == "alice@example.com"

    bad = client.post("/api/user/login", json={"email": "alice@example.com", "password": "nope"})
    assert bad.status_code == 401
