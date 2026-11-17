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

    from pydantic import BaseModel
    from werkzeug.exceptions import abort
    from lapp.utils.request import parse_json

    class _Body(BaseModel):
        name: str

    @app.route('/test/boom')
    def boom():
        raise RuntimeError("SELECT secret FROM /var/lib/pg")

    @app.route('/test/abort/<int:code>')
    def abort_code(code):
        abort(code)

    @app.route('/test/parse', methods=['POST'])
    def parse():
        return {"name": parse_json(_Body).name}

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
        # Pooled connections keep server-side prepared statements from earlier tests; after the tables are
        # recreated the first query on one fails with "cached plan must not change result type" and aborts
        # the transaction (seen after test_generate_new_id's threads). Start every test on fresh connections.
        db_manager.engine.dispose()
        yield db_manager
        db_manager.close_session()

