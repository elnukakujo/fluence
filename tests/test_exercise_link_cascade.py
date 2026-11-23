"""Deleting an element removes its exercise links and keeps the exercise (RD-141)."""
from lapp.models.containers import Language, Lesson
from lapp.models.system_data import User


def _login(app, db, uid):
    with db.session_scope() as s:
        db.insert(User(id=uid, username=uid, email=f"{uid}@x.com"), session=s, commit=False)


def test_deleting_an_element_removes_its_exercise_links_and_keeps_the_exercise(app, db):
    from lapp.models.features import Exercise, Vocabulary
    from lapp.models.components import Word
    _login(app, db, "user_U1")
    with db.session_scope() as s:
        db.insert(Language(id="lang_L1", user_id="user_U1", name="l"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="t", position=0), session=s, commit=False)
        db.insert(Word(id="word_W1", language_id="lang_L1", word="水"), session=s, commit=False)
        voc = Vocabulary(id="voc_V1", lesson_id="lesson_L1", word_id="word_W1")
        db.insert(voc, session=s, commit=False)
        ex = Exercise(id="ex_E1", lesson_id="lesson_L1", exercise_type="true_false", question="q", answer="a")
        ex.related_vocabulary = [voc]
        db.insert(ex, session=s, commit=False)
    with db.session_scope() as s:
        assert db.delete(s.get(Vocabulary, "voc_V1"), session=s, commit=False) is True
    with db.session_scope() as s:
        assert s.get(Vocabulary, "voc_V1") is None and s.get(Exercise, "ex_E1").related_vocabulary == []
