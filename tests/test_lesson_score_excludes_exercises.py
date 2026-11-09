"""Exercises are tools: their score is internal and never aggregated into the lesson."""
from lapp.models.system_data import User
from lapp.models.containers import Language, Lesson
from lapp.models.components import Word
from lapp.models.features import Vocabulary, Exercise
from lapp.services.system_data import ScoreService
from lapp.services.containers import LessonService
from lapp.services.features import ExerciseService

U = "user_U1"


def _seed(db, vocab=True, linked=False):
    with db.session_scope() as s:
        db.insert(User(id=U, username="a", email="a@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id=U, name="Japanese",
                           target_iso639_2t="jpn", source_iso639_2t="eng"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id=U, language_id="lang_L1", title="L1"), session=s, commit=False)
        if vocab:
            db.insert(Word(id="word_W1", language_id="lang_L1", word="水"), session=s, commit=False)
            db.insert(Vocabulary(id="voc_V1", lesson_id="lesson_L1", word_id="word_W1"), session=s, commit=False)
        ex = Exercise(id="ex_E1", lesson_id="lesson_L1", exercise_type="essay", question="q", answer="a")
        db.insert(ex, session=s, commit=False)
        if linked:
            s.flush()
            ex.related_vocabulary.append(s.get(Vocabulary, "voc_V1"))


def test_lesson_score_is_average_of_vocab_grammar_calligraphy_only(db):
    _seed(db)
    ScoreService().set(U, "voc_V1", 80.0, 0.5)
    ScoreService().set(U, "ex_E1", 20.0, 0.5)
    assert LessonService().update_score("lesson_L1", user_id=U).score == 80.0


def test_lesson_with_only_exercises_scores_zero(db):
    _seed(db, vocab=False)
    ScoreService().set(U, "ex_E1", 90.0, 0.5)
    r = LessonService().update_score("lesson_L1", user_id=U)
    assert (r.score, r.difficulty) == (0.0, 0.5)


def test_exercise_result_still_reaches_linked_vocabulary(db):
    _seed(db, linked=True)
    ExerciseService().update_score("ex_E1", 1.0, 1000, user_id=U)
    assert ScoreService().get(U, "voc_V1").score > 0.0
