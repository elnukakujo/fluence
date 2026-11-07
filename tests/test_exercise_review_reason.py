from lapp.models.system_data import User
from lapp.models.containers import Language, Lesson
from lapp.models.features import Exercise
from lapp.schemas import ExerciseDict
from lapp.services import ExerciseService, ReviewService


def _seed(db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id="user_U1", name="J", target_iso639_2t="jpn"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="L", position=0), session=s, commit=False)


def _d(**kw):
    return ExerciseDict(**{"lesson_id": "lesson_L1", "exercise_type": "essay", "question": "q", "answer": "a", **kw})


def test_review_reason_makes_the_exercise_not_ready_and_round_trips(db):
    _seed(db)
    ex = ExerciseService().create(_d(review_reason="answer wrong", generation_batch_id="batch_1"), as_dict=True)
    assert ex["needs"] == ["review"] and ex["review_reason"] == "answer wrong" and ex["generation_batch_id"] == "batch_1"


def test_explicit_none_clears_the_reason_and_omitting_keeps_it(db):
    _seed(db)
    ex = ExerciseService().create(_d(review_reason="x"), as_dict=True)
    kept = ExerciseService().update(ex["id"], _d(question="q2"), as_dict=True)
    assert kept["review_reason"] == "x"
    cleared = ExerciseService().update(ex["id"], _d(review_reason=None), as_dict=True)
    assert cleared["review_reason"] is None and cleared["needs"] == []


def test_daily_review_skips_exercises_waiting_for_review(db):
    _seed(db)
    with db.session_scope() as s:
        db.insert(Exercise(id="ex_ok", lesson_id="lesson_L1", exercise_type="essay", question="q", answer="a"), session=s, commit=False)
        db.insert(Exercise(id="ex_wait", lesson_id="lesson_L1", exercise_type="essay", question="q", answer="a", review_reason="check"), session=s, commit=False)
    ids = [c["id"] for c in ReviewService().get_review_cards(language_id="lang_L1", user_id="user_U1", as_dict=True)]
    assert ids == ["ex_ok"]
