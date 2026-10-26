"""Auth route tests (Task 7)."""
from werkzeug.security import generate_password_hash

from lapp.models.system_data import User


def _make_user(db, **kwargs):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com", **kwargs), session=s, commit=False)


def test_login_success_sets_cookie(app, db):
    _make_user(db, password_hash=generate_password_hash("secret"))
    client = app.test_client()
    res = client.post('/api/auth/login', json={'email': 'a@x.com', 'password': 'secret', 'remember': True})
    assert res.status_code == 200
    assert res.get_json()['user']['email'] == 'a@x.com'
    assert 'session_token' in (res.headers.get('Set-Cookie') or '')


def test_login_cookie_not_secure_over_http(app, db):
    # A Secure cookie is dropped by browsers over plain HTTP. The deploy serves
    # the app over HTTP (frontend on :8080, no TLS), so forcing Secure=True in
    # prod logs everyone straight back out. The flag must mirror the actual scheme.
    _make_user(db, password_hash=generate_password_hash("secret"))
    client = app.test_client()
    res = client.post('/api/auth/login', json={'email': 'a@x.com', 'password': 'secret'})
    assert res.status_code == 200
    assert 'Secure' not in (res.headers.get('Set-Cookie') or '')


def test_login_wrong_password(app, db):
    _make_user(db, password_hash=generate_password_hash("secret"))
    client = app.test_client()
    res = client.post('/api/auth/login', json={'email': 'a@x.com', 'password': 'wrong'})
    assert res.status_code == 401


def test_login_blocked_regardless_of_password(app, db):
    _make_user(db, password_hash=generate_password_hash("secret"), blocked=True)
    client = app.test_client()
    res = client.post('/api/auth/login', json={'email': 'a@x.com', 'password': 'wrong'})
    assert res.status_code == 403
    assert res.get_json()['error'] == 'account_blocked'


def test_logout_clears_cookie(app, db):
    _make_user(db, password_hash=generate_password_hash("secret"))
    client = app.test_client()
    assert client.post('/api/auth/login', json={'email': 'a@x.com', 'password': 'secret'}).status_code == 200
    res = client.post('/api/auth/logout')
    assert res.status_code == 200
    assert 'session_token=' in (res.headers.get('Set-Cookie') or '')


def test_me_returns_user(app, db):
    _make_user(db, password_hash=generate_password_hash("secret"), is_admin=True)
    client = app.test_client()
    client.post('/api/auth/login', json={'email': 'a@x.com', 'password': 'secret'})
    res = client.get('/api/auth/me')
    assert res.status_code == 200
    assert res.get_json()['user']['is_admin'] is True


def test_me_unauthorized(app, db):
    client = app.test_client()
    assert client.get('/api/auth/me').status_code == 401
