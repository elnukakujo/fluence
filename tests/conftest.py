"""Shared test fixtures: a Flask app on a throwaway SQLite DB with fresh tables.

"""
import pytest

from lapp.api.app import create_app
from lapp.core.database import db_manager


def _register_test_routes(app):
    """Routes used by test_auth_middleware. Flask refuses new routes once the app has served a request,
    so they must exist before any test (in any file) makes one."""
    from flask import jsonify
    from lapp.core.auth import admin_required, login_required

    @app.route('/test/protected')
    @login_required
    def protected():
        return jsonify({'ok': True})

    @app.route('/test/admin')
    @admin_required
    def admin_only():
        return jsonify({'ok': True})


@pytest.fixture(scope="session")
def app():
    app = create_app(config_name="test")
    _register_test_routes(app)
    return app


@pytest.fixture()
def db(app):
    """Fresh schema for each test; yields the db_manager singleton."""
    with app.app_context():
        db_manager.drop_tables()
        db_manager.create_tables()
        yield db_manager
        db_manager.close_session()
