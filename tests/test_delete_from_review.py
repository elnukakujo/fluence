"""RC-23 / EM-12: the review's Delete button calls the single-element DELETE of each studied kind; the element goes with its scores."""
import pytest

from lapp.models.system_data import User, Score
from lapp.models.containers import Language, Lesson
from lapp.models.components import Word, Character
from lapp.models.features import Vocabulary, Grammar, Calligraphy, Exercise
from lapp.services.auth import AuthService
from lapp.services.system_data import ScoreService

U, OTHER = "user_U1", "user_U2"
KINDS = [("vocabulary", "voc_V1", Vocabulary, "recall"), ("grammar", "gram_G1", Grammar, "recognition"),
         ("calligraphy", "call_C1", Calligraphy, "recall"), ("exercise", "ex_E1", Exercise, "recall")]


def _seed(db):
    with db.session_scope() as s:
        for uid in (U, OTHER):
            db.insert(User(id=uid, username=uid, email=f"{uid}@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id=U, name="J", target_iso639_2t="jpn"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id=U, language_id="lang_L1", title="L1"), session=s, commit=False)
        db.insert(Word(id="word_W1", language_id="lang_L1", word="w"), session=s, commit=False)
        db.insert(Character(id="char_C1", language_id="lang_L1", character="日"), session=s, commit=False)
        db.insert(Vocabulary(id="voc_V1", lesson_id="lesson_L1", word_id="word_W1"), session=s, commit=False)
        db.insert(Grammar(id="gram_G1", lesson_id="lesson_L1", title="g", explanation="e"), session=s, commit=False)
        db.insert(Calligraphy(id="call_C1", lesson_id="lesson_L1", character_id="char_C1"), session=s, commit=False)
        db.insert(Exercise(id="ex_E1", lesson_id="lesson_L1", exercise_type="answering", question="q", answer="a"), session=s, commit=False)


def _client(app, uid):
    c = app.test_client()
    c.set_cookie("session_token", AuthService().create_session(uid, remember=False))
    return c


@pytest.mark.parametrize("kind,eid,model,skill", KINDS, ids=[k[0] for k in KINDS])
def test_the_owner_deletes_an_element_and_its_scores_go_with_it(app, db, kind, eid, model, skill):
    _seed(db)
    ScoreService().record(U, eid, skill, 1.0, "typed")
    r = _client(app, U).delete(f"/api/{kind}/{eid}")
    assert r.status_code in (200, 204)
    with db.session_scope() as s:
        assert s.get(model, eid) is None
        assert s.query(Score).filter(Score.element_id.like(f"{eid}%")).count() == 0


@pytest.mark.parametrize("kind,eid,model,skill", KINDS, ids=[k[0] for k in KINDS])
def test_someone_without_write_access_cannot_delete(app, db, kind, eid, model, skill):
    _seed(db)
    r = _client(app, OTHER).delete(f"/api/{kind}/{eid}")
    assert r.status_code in (401, 403, 404)
    with db.session_scope() as s:
        assert s.get(model, eid) is not None
