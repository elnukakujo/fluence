"""Write-path migration: scoring a feature writes per-user Score rows + cascade."""
from lapp.models.system_data import User, Score
from lapp.models.containers import Language, Lesson
from lapp.models.components import Word
from lapp.models.features import Vocabulary
from lapp.services.system_data import ScoreService
from lapp.services.features import VocabularyService


def _seed_users(db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(User(id="user_U2", username="b", email="b@x.com"), session=s, commit=False)


def _seed_vocabulary(db):
    with db.session_scope() as s:
        db.insert(Language(id="lang_L1", user_id="user_U1", name="Japanese",
                           target_iso639_2t="jpn", source_iso639_2t="eng"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="L1"), session=s, commit=False)
        db.insert(Word(id="word_W1", language_id="lang_L1", word="水"), session=s, commit=False)
        db.insert(Vocabulary(id="voc_V1", lesson_id="lesson_L1", word_id="word_W1"), session=s, commit=False)


def test_score_vocabulary_updates_lesson_and_language(db):
    _seed_users(db)
    _seed_vocabulary(db)
    VocabularyService().update_score("voc_V1", 0.9, duration_ms=1000, hint_used=False, user_id="user_U1")
    assert ScoreService().get("user_U1", "lesson_L1").score > 0.0
    assert ScoreService().get("user_U1", "lang_L1").score > 0.0


def test_collaborator_score_isolated(db):
    _seed_users(db)
    _seed_vocabulary(db)
    VocabularyService().update_score("voc_V1", 0.9, duration_ms=1000, hint_used=False, user_id="user_U2")
    own = ScoreService().get("user_U1", "voc_V1")
    assert own is None or own.score == 0.0
    assert ScoreService().get("user_U2", "voc_V1").score > 0.0


# --- routes: skill and evidence required, inputs validated (spec 2 Task 4) ---
import pytest
from lapp.services.auth import AuthService

OK = {"vocabulary_id": "voc_V1", "similarity": 0.8, "skill": "recall", "evidence_type": "typed", "duration_ms": 5}


def _client(app, db):
    _seed_users(db)
    _seed_vocabulary(db)
    c = app.test_client()
    c.set_cookie("session_token", AuthService().create_session("user_U1", remember=False))
    return c


def test_valid_answer_returns_levels(app, db):
    r = _client(app, db).post("/api/vocabulary/score", json=OK)
    assert r.status_code == 200
    assert r.json == {"success": True, "level_before": "learning", "level_after": "learning"}


@pytest.mark.parametrize("change", [
    {"skill": None},                    # missing skill
    {"evidence_type": None},            # missing evidence
    {"similarity": 50},                 # audit S4: out of 0..1
    {"similarity": -0.1},
    {"duration_ms": 10**9},             # beyond 10 minutes
    {"skill": "calligraphy"},           # unknown skill
    {"evidence_type": "telepathy"},
    {"side": "left"},
])
def test_invalid_answer_is_400(app, db, change):
    body = {k: v for k, v in {**OK, **change}.items() if v is not None}
    assert _client(app, db).post("/api/vocabulary/score", json=body).status_code == 400


def test_skill_must_fit_the_kind(app, db):
    c = _client(app, db)
    with db.session_scope() as s:
        from lapp.models.features import Grammar
        db.insert(Grammar(id="gram_G1", lesson_id="lesson_L1", title="g", explanation="e"), session=s, commit=False)
    body = {"grammar_id": "gram_G1", "similarity": 0.8, "skill": "recall", "evidence_type": "typed", "duration_ms": 5}
    assert c.post("/api/grammar/score", json=body).status_code == 400     # grammar only has recognition
    assert c.post("/api/grammar/score", json={**body, "skill": "recognition"}).status_code == 200


def test_unknown_element_is_404(app, db):
    assert _client(app, db).post("/api/vocabulary/score", json={**OK, "vocabulary_id": "voc_nope"}).status_code == 404
