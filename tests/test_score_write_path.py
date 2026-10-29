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
