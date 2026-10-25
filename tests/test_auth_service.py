"""AuthService + UserSession tests (Task 1 + Task 4)."""
from datetime import datetime, timedelta

from werkzeug.security import generate_password_hash

from lapp.services.auth import AuthService
from lapp.models.system_data import User, UserSession


def _make_user(db, **kwargs):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com", **kwargs), session=s, commit=False)


def test_user_session_roundtrip(db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(UserSession(id="sess_S1", user_id="user_U1", token_hash="abc"), session=s, commit=False)

    with db.session_scope() as s:
        row = db.find_by_attr(UserSession, {"token_hash": "abc"}, session=s)
        assert row is not None and row.user_id == "user_U1"


def test_authenticate_success(db):
    _make_user(db, password_hash=generate_password_hash("secret"))
    user, status = AuthService().authenticate("a@x.com", "secret")
    assert status is None and user.id == "user_U1"


def test_authenticate_wrong_password(db):
    _make_user(db, password_hash=generate_password_hash("secret"))
    user, status = AuthService().authenticate("a@x.com", "wrong")
    assert user is None and status == "invalid"


def test_authenticate_unknown_email(db):
    user, status = AuthService().authenticate("nobody@x.com", "x")
    assert user is None and status == "invalid"


def test_authenticate_blocked_regardless_of_password(db):
    _make_user(db, password_hash=generate_password_hash("secret"), blocked=True)
    user, status = AuthService().authenticate("a@x.com", "secret")
    assert user is None and status == "blocked"
    user2, status2 = AuthService().authenticate("a@x.com", "wrong")
    assert user2 is None and status2 == "blocked"


def test_authenticate_needs_password(db):
    _make_user(db)  # no password_hash
    user, status = AuthService().authenticate("a@x.com", "")
    assert status == "needs_password" and user.id == "user_U1"


def test_create_session_hashes_token(db):
    _make_user(db)
    raw = AuthService().create_session("user_U1", remember=False)
    with db.session_scope() as s:
        sess = db.find_by_attr(UserSession, {"user_id": "user_U1"}, session=s)
        assert sess is not None
        assert sess.token_hash != raw  # stored as SHA-256, not raw
        assert sess.expires_at is None  # not remembered


def test_create_session_remember_sets_expiry(db):
    _make_user(db)
    AuthService().create_session("user_U1", remember=True)
    with db.session_scope() as s:
        sess = db.find_by_attr(UserSession, {"user_id": "user_U1"}, session=s)
        assert sess.expires_at is not None


def test_resolve_valid_and_revoke(db):
    _make_user(db)
    raw = AuthService().create_session("user_U1", remember=False)
    assert AuthService().resolve(raw) is not None
    AuthService().revoke(raw)
    assert AuthService().resolve(raw) is None


def test_resolve_blocked_returns_none(db):
    _make_user(db, blocked=True)
    raw = AuthService().create_session("user_U1", remember=False)
    assert AuthService().resolve(raw) is None


def test_resolve_expired_returns_none(db):
    _make_user(db)
    raw = AuthService().create_session("user_U1", remember=True)
    with db.session_scope() as s:
        sess = db.find_by_attr(UserSession, {"user_id": "user_U1"}, session=s)
        sess.expires_at = datetime.now() - timedelta(days=1)
        db.modify(sess, session=s, commit=False)
    assert AuthService().resolve(raw) is None


def test_on_failure_locks_after_five(db):
    _make_user(db, password_hash=generate_password_hash("secret"))
    svc = AuthService()
    for _ in range(5):
        svc.on_failure("a@x.com")
    user, status = svc.authenticate("a@x.com", "secret")
    assert status == "locked"


def test_on_success_resets_lockout(db):
    _make_user(db, password_hash=generate_password_hash("secret"))
    svc = AuthService()
    for _ in range(5):
        svc.on_failure("a@x.com")
    assert svc.authenticate("a@x.com", "secret")[1] == "locked"
    svc.on_success("user_U1")
    user, status = svc.authenticate("a@x.com", "secret")
    assert status is None
