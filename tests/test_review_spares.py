"""Spare ready exercises sent along with the review queue."""
from conftest import link_all_exercises
from lapp.core.database import db_manager
from lapp.models.system_data import User
from lapp.models.containers import Language, Lesson
from lapp.models.features import Exercise
from lapp.schemas.system_data.user_preferences import UserPreferencesDict
from lapp.services import ReviewService
from lapp.services.features import review as review_module
from lapp.services.system_data import UserPreferencesService


def _seed(db, n=12, broken=0):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id="user_U1", name="J", target_iso639_2t="jpn"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="L", position=0), session=s, commit=False)
        for i in range(n):
            db.insert(Exercise(id=f"ex_S{i}", lesson_id="lesson_L1", exercise_type="translate", question=f"say {i}", answer="ok"), session=s, commit=False)
        for i in range(broken):
            db.insert(Exercise(id=f"ex_B{i}", lesson_id="lesson_L1", exercise_type="quizz", question="q", answer="a", review_reason="check"), session=s, commit=False)
    UserPreferencesService().create(UserPreferencesDict(user_id="user_U1", daily_goal_minutes=1))


def _cards():
    link_all_exercises(db_manager)
    return ReviewService().get_review_cards(language_id="lang_L1", user_id="user_U1", as_dict=True)


def test_spares_are_ready_disjoint_and_not_in_the_queue(db):
    _seed(db, broken=2)
    cards = _cards()
    queue, spares = [c for c in cards if not c["spare"]], [c for c in cards if c["spare"]]
    assert 0 < len(spares) <= review_module.SPARE_EXERCISES
    assert not {c["id"] for c in queue} & {c["id"] for c in spares}
    assert not any(c["id"].startswith("ex_B") for c in cards)


def test_spares_do_not_change_the_queue(db, monkeypatch):
    _seed(db)
    with_spares = [c["id"] for c in _cards() if not c["spare"]]
    monkeypatch.setattr(review_module, "SPARE_EXERCISES", 0)
    assert [c["id"] for c in _cards()] == with_spares


def test_no_spares_when_pool_is_empty(db):
    _seed(db, n=1)
    assert [c["spare"] for c in _cards()] == [False]
