"""EX-17: a hand-made exercise names a grammar of its lesson when the lesson has one."""
from lapp.models.system_data import User
from lapp.models.containers import Language, Lesson
from lapp.models.components import Word
from lapp.models.features import Grammar, Vocabulary
from lapp.services.auth import AuthService

U = "user_U1"


def _seed(db, grammar=True):
    with db.session_scope() as s:
        db.insert(User(id=U, username="a", email="a@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id=U, name="J", target_iso639_2t="jpn", source_iso639_2t="eng"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id=U, language_id="lang_L1", title="L1"), session=s, commit=False)
        db.insert(Word(id="word_W1", language_id="lang_L1", word="w"), session=s, commit=False)
        db.insert(Vocabulary(id="voc_V1", lesson_id="lesson_L1", word_id="word_W1"), session=s, commit=False)
        if grammar:
            db.insert(Grammar(id="gram_G1", lesson_id="lesson_L1", title="g", explanation="e"), session=s, commit=False)


def _post(app, **over):
    c = app.test_client()
    c.set_cookie("session_token", AuthService().create_session(U, remember=False))
    body = {"lesson_id": "lesson_L1", "exercise_type": "answering", "question": "Q?", "answer": "A", "related_vocabulary": ["voc_V1"], **over}
    return c.post("/api/exercise/", json=body)


def test_create_without_grammar_is_rejected_when_the_lesson_has_one(app, db):
    _seed(db)
    r = _post(app)
    assert r.status_code == 400 and r.get_json()["error"] == "grammar_required"


def test_create_with_a_grammar_is_accepted(app, db):
    _seed(db)
    assert _post(app, related_grammar=["gram_G1"]).status_code == 201


def test_create_is_allowed_when_the_lesson_has_no_grammar(app, db):
    _seed(db, grammar=False)
    assert _post(app).status_code == 201


def test_machine_made_create_is_not_checked_by_the_route(app, db):
    _seed(db)
    assert _post(app, machine_made=True).status_code == 201
