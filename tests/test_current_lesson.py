"""The language's current lesson (DM-18, SC-13): the first lesson that is not known (score < 60); once the soft gate opened, the first lesson
counts as known for good (DM-46: ever known is not undone by decay). All known: the last lesson."""
from test_study_goal import _seed
from lapp.services.containers.language import LanguageService
from lapp.services.features.lesson_gate import GateService
from lapp.services.system_data import ScoreService

U, L = "user_U1", "lang_L1"


def _current():
    return LanguageService()._find_current_lesson(language_id=L, user_id=U)


def test_no_scores_the_first_lesson(db):
    _seed(db, gate_open=False)
    assert _current() == "lesson_A"


def test_known_means_60_not_75(db):
    _seed(db, gate_open=False)
    ScoreService().set(U, "lesson_A", score=65.0, difficulty=0.5)       # known (>= 60), so the next lesson is the current one
    assert _current() == "lesson_B"


def test_below_known_stays_current(db):
    _seed(db, gate_open=False)
    ScoreService().set(U, "lesson_A", score=59.0, difficulty=0.5)
    assert _current() == "lesson_A"


def test_all_known_gives_the_last_lesson(db):
    _seed(db, gate_open=False)
    for lesson in ("lesson_A", "lesson_B"):
        ScoreService().set(U, lesson, score=80.0, difficulty=0.5)
    assert _current() == "lesson_B"


def test_an_opened_gate_is_not_closed_by_decay(db):
    _seed(db, gate_open=False)
    GateService().unlock(U, L, "lesson_A")
    ScoreService().set(U, "lesson_A", score=20.0, difficulty=0.5)       # the first lesson decayed below known after it was known once
    assert _current() == "lesson_B"
