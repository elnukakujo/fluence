"""A full merge asks per conflicting item (keep / overwrite / merge) and recomputes only the actor's scores (DM-24, DM-65)."""
import pytest
from collab_helpers import client_for, seed

from lapp.models.components import Word
from lapp.models.containers import Lesson
from lapp.models.system_data import Collaboration
from lapp.services.system_data import CollaborationService
from lapp.services.system_data.collaboration import MergeConflicts


def _setup(db):
    seed(db)
    with db.session_scope() as s:                               # U2 has the same two words with different translations, plus one only they know
        db.insert(Word(id="word_W2", language_id="lang_L1", word="火", translation="fire", phonetic=None), session=s, commit=False)
        db.insert(Word(id="word_X1", language_id="lang_L2", word="水", translation="aqua", phonetic="mizu"), session=s, commit=False)
        db.insert(Word(id="word_X2", language_id="lang_L2", word="火", translation="flame", phonetic="hi"), session=s, commit=False)
        db.insert(Word(id="word_X3", language_id="lang_L2", word="木", translation="tree"), session=s, commit=False)
        db.insert(Lesson(id="lesson_X1", user_id="user_U2", language_id="lang_L2", title="Theirs"), session=s, commit=False)


def _consent_ready():
    collab = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1", mode="full")
    CollaborationService().accept(collab.id, mode="full")            # same ISO on both sides -> awaiting the owner's consent
    return collab.id


def test_two_conflicting_words_need_two_decisions_and_nothing_changes_until_then(db):
    _setup(db)
    collab_id = _consent_ready()
    with pytest.raises(MergeConflicts) as e:
        CollaborationService().consent(collab_id)
    assert {c["key"] for c in e.value.conflicts} == {"水", "火"} and e.value.conflicts[0]["diff"]
    with pytest.raises(MergeConflicts):                               # one decision is not enough
        CollaborationService().consent(collab_id, decisions={"word_X1": "keep"})
    with db.session_scope() as s:
        assert s.get(Word, "word_W1").translation == "water" and s.get(Collaboration, collab_id).status == "awaiting_master_consent"


def test_each_decision_is_applied(db):
    _setup(db)
    collab_id = _consent_ready()
    CollaborationService().consent(collab_id, decisions={"word_X1": "overwrite", "word_X2": "merge"})
    with db.session_scope() as s:
        mizu = s.query(Word).filter(Word.language_id == "lang_L1", Word.word == "水").one()
        hi = s.query(Word).filter(Word.language_id == "lang_L1", Word.word == "火").one()
        assert mizu.translation == "aqua" and mizu.phonetic == "mizu"        # overwrite: their content wins
        assert hi.translation == "fire" and hi.phonetic == "hi"                # merge: mine kept, the empty phonetic filled
        assert s.query(Word).filter(Word.language_id == "lang_L1", Word.word == "木").count() == 1      # a word only they had is added
        assert s.get(Collaboration, collab_id).status == "accepted"


def test_the_route_answers_409_with_the_conflicts_then_accepts_decisions(app, db):
    _setup(db)
    collab_id = _consent_ready()
    owner = client_for(app, "user_U1")
    res = owner.post(f"/api/collaboration/{collab_id}/consent")
    assert res.status_code == 409 and len(res.get_json()["conflicts"]) == 2
    assert owner.post(f"/api/collaboration/{collab_id}/consent", json={"decisions": {"word_X1": "nope"}}).status_code == 400
    assert owner.post(f"/api/collaboration/{collab_id}/consent", json={"decisions": {"word_X1": "keep", "word_X2": "keep"}}).status_code == 200


def test_a_lesson_merge_recomputes_only_the_actors_scores(db):
    from lapp.models.system_data import Score
    from lapp.services import LessonService
    from lapp.services.system_data import ScoreService
    seed(db)
    with db.session_scope() as s:
        db.insert(Lesson(id="lesson_L3", user_id="user_U1", language_id="lang_L1", title="Second"), session=s, commit=False)
    ScoreService().record("user_U2", "voc_V1", "recall", 0.7, "typed")
    with db.session_scope() as s:
        before = [(r.element_id, r.score) for r in s.query(Score).filter(Score.user_id == "user_U2").all()]
    LessonService().merge("lesson_L1", "lesson_L3", "Merged", None, None, user_id="user_U1")
    with db.session_scope() as s:
        assert sorted((r.element_id, r.score) for r in s.query(Score).filter(Score.user_id == "user_U2").all()) == sorted(before)
