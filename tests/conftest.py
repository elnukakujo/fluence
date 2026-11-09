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
        # Pooled connections keep server-side prepared statements from earlier tests; after the tables are
        # recreated the first query on one fails with "cached plan must not change result type" and aborts
        # the transaction (seen after test_generate_new_id's threads). Start every test on fresh connections.
        db_manager.engine.dispose()
        yield db_manager
        db_manager.close_session()


def link_all_exercises(db, user_id="user_U1"):
    """The daily review only holds exercises whose linked elements are known a little: link every exercise to one scored
    vocabulary that lives in another language, so the reviewed queues themselves don't change."""
    from lapp.models.components import Word
    from lapp.models.containers import Language, Lesson
    from lapp.models.features import Exercise, Vocabulary
    from lapp.services.system_data import ScoreService
    with db.session_scope() as s:
        if s.get(Vocabulary, "voc_LINK") is None:
            db.insert(Language(id="lang_LINK", user_id=user_id, name="X", target_iso639_2t="jpn"), session=s, commit=False)
            db.insert(Lesson(id="lesson_LINK", user_id=user_id, language_id="lang_LINK", title="X", position=0), session=s, commit=False)
            db.insert(Word(id="word_LINK", language_id="lang_LINK", word="x"), session=s, commit=False)
            db.insert(Vocabulary(id="voc_LINK", lesson_id="lesson_LINK", word_id="word_LINK"), session=s, commit=False)
            s.flush()
        voc = s.get(Vocabulary, "voc_LINK")
        for ex in s.query(Exercise).all():
            if voc not in ex.related_vocabulary:
                ex.related_vocabulary.append(voc)
    ScoreService().set(user_id, "voc_LINK", 50.0, 0.5)
