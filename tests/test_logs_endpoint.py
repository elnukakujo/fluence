"""Admin-only /api/logs endpoint serves the in-memory ring buffer."""
import logging

from lapp.services.auth import AuthService
from lapp.models.system_data import User


def _user_with_session(db, uid, username, email, **kwargs):
    with db.session_scope() as s:
        db.insert(User(id=uid, username=username, email=email, **kwargs), session=s, commit=False)
    return AuthService().create_session(uid, remember=False)


def test_nonadmin_cannot_get_logs(app, db):
    token_b = _user_with_session(db, "user_U2", "b", "b@x.com")
    client = app.test_client()
    client.set_cookie('session_token', token_b)
    assert client.get('/api/logs').status_code == 403


def test_admin_gets_buffered_logs(app, db):
    token_a = _user_with_session(db, "user_U1", "a", "a@x.com", is_admin=True)
    client = app.test_client()
    client.set_cookie('session_token', token_a)

    # Emit a log line and confirm it shows up in the endpoint output.
    logging.getLogger("test.logs.endpoint").warning("ring-buffer-probe")
    res = client.get('/api/logs')
    assert res.status_code == 200
    logs = res.get_json()['logs']
    assert any("ring-buffer-probe" in line for line in logs)


def test_requests_are_logged(app, db):
    token_a = _user_with_session(db, "user_U1", "a", "a@x.com", is_admin=True)
    client = app.test_client()
    client.set_cookie('session_token', token_a)

    # Hit a real endpoint — it should produce a request log line.
    client.get('/api/user/')
    res = client.get('/api/logs')
    logs = res.get_json()['logs']
    assert any("GET /api/user/ 200" in line for line in logs)
