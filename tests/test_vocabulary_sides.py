"""Vocabulary service/route take a side; side rows follow the vocabulary."""
import pytest

from lapp.models.system_data import User, Score
from lapp.models.containers import Language, Lesson
from lapp.models.components import Word
from lapp.models.features import Vocabulary
from lapp.services.auth import AuthService
from lapp.services.features import VocabularyService
from lapp.services.system_data import ScoreService


def _seed(db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id="user_U1", name="Japanese",
                           target_iso639_2t="jpn", source_iso639_2t="eng"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="L1", position=0), session=s, commit=False)
        db.insert(Word(id="word_W1", language_id="lang_L1", word="水"), session=s, commit=False)
        db.insert(Vocabulary(id="voc_V1", lesson_id="lesson_L1", word_id="word_W1"), session=s, commit=False)


def _ids(db):
    with db.session_scope() as s:
        return sorted(r.element_id for r in s.query(Score).filter(Score.element_id.like("voc_V1%")))


def test_side_writes_only_that_side(db):
    _seed(db)
    VocabularyService().update_score("voc_V1", 0.8, duration_ms=10, user_id="user_U1", side="front")
    assert _ids(db) == ["voc_V1", "voc_V1#front"]


def test_no_side_updates_both_sides_one_old_step(db):
    _seed(db)
    VocabularyService().update_score("voc_V1", 0.8, duration_ms=10, user_id="user_U1")
    assert _ids(db) == ["voc_V1", "voc_V1#back", "voc_V1#front"]
    twin = ScoreService().record("user_U1", "voc_twin", 0.8).score
    assert ScoreService().get("user_U1", "voc_V1").score == pytest.approx(twin, abs=1e-3)


def test_bad_side_raises(db):
    _seed(db)
    with pytest.raises(ValueError):
        VocabularyService().update_score("voc_V1", 0.8, duration_ms=10, user_id="user_U1", side="left")


def test_route_side_and_bad_side(app, db):
    _seed(db)
    token = AuthService().create_session("user_U1", remember=False)
    c = app.test_client()
    c.set_cookie("session_token", token)
    ok = c.post("/api/vocabulary/score", json={"vocabulary_id": "voc_V1", "score": 0.8, "duration_ms": 5, "side": "back"})
    assert ok.status_code == 200
    bad = c.post("/api/vocabulary/score", json={"vocabulary_id": "voc_V1", "score": 0.8, "duration_ms": 5, "side": "left"})
    assert bad.status_code == 400


def test_delete_removes_side_rows(db):
    _seed(db)
    VocabularyService().update_score("voc_V1", 0.8, duration_ms=10, user_id="user_U1", side="front")
    assert VocabularyService().delete("voc_V1")
    assert _ids(db) == []


def test_bulk_delete_removes_side_rows(app, db):
    _seed(db)
    VocabularyService().update_score("voc_V1", 0.8, duration_ms=10, user_id="user_U1", side="front")
    token = AuthService().create_session("user_U1", remember=False)
    c = app.test_client()
    c.set_cookie("session_token", token)
    assert c.post("/api/elements/bulk-delete", json={"ids": ["voc_V1"]}).status_code == 200
    assert _ids(db) == []


def test_serialized_vocabulary_has_side_fields(db):
    _seed(db)
    VocabularyService().update_score("voc_V1", 0.8, duration_ms=10, user_id="user_U1", side="front")
    out = ScoreService().merge("user_U1", [{"id": "voc_V1"}])[0]
    assert out["front_score"] > 0 and out["back_score"] == 0.0
    assert out["front_difficulty"] != 0.5 or out["back_difficulty"] == 0.5
    assert out["back_difficulty"] == 0.5
