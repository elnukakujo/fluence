from lapp.models.system_data import User
from lapp.models.containers import Language, Lesson
from lapp.models.features import Exercise
from lapp.schemas import ExerciseDict
from lapp.services import ExerciseService
from lapp.services.system_data import CollaborationService
from lapp.models.system_data import Score  # noqa: F401  (models import order)


def _seed(db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id="user_U1", name="J", target_iso639_2t="jpn"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="L", position=0), session=s, commit=False)


def _make(**kw):
    return ExerciseService().create(ExerciseDict(lesson_id="lesson_L1", exercise_type="essay", question="q", answer="a", **kw), as_dict=True)


def test_category_round_trip_and_clear(db):
    _seed(db)
    ex = _make(category="listening")
    assert ex["category"] == "listening"
    upd = ExerciseService().update(ex["id"], ExerciseDict(lesson_id="lesson_L1", exercise_type="essay", question="q", answer="a", category="reading"), as_dict=True)
    assert upd["category"] == "reading"
    cleared = ExerciseService().update(ex["id"], ExerciseDict(lesson_id="lesson_L1", exercise_type="essay", question="q", answer="a", category=None), as_dict=True)
    assert cleared["category"] is None


def test_omitting_category_on_update_keeps_it(db):
    _seed(db)
    ex = _make(category="writing")
    upd = ExerciseService().update(ex["id"], ExerciseDict(lesson_id="lesson_L1", exercise_type="essay", question="q2", answer="a"), as_dict=True)
    assert upd["category"] == "writing"


def test_blank_is_none_and_any_slug_accepted(db):
    _seed(db)
    assert _make(category="  ")["category"] is None
    assert _make(category="whatever-slug")["category"] == "whatever-slug"


def test_default_none(db):
    _seed(db)
    assert _make()["category"] is None
