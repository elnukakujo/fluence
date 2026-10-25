"""Auth middleware + decorators tests (Task 5)."""
import pytest
from flask import jsonify

from lapp.core.auth import login_required, admin_required
from lapp.services.auth import AuthService
from lapp.models.system_data import User


@pytest.fixture(scope="session", autouse=True)
def _register_test_routes(app):
    @app.route('/test/protected')
    @login_required
    def protected():
        return jsonify({'ok': True})

    @app.route('/test/admin')
    @admin_required
    def admin_only():
        return jsonify({'ok': True})


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
