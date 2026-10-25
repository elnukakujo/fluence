"""Daily review (exercises included, lesson title attached) and stable lesson ordering."""
from datetime import datetime, timedelta

from lapp.core.database import db_manager
from lapp.models.containers import Language, Lesson
from lapp.models.features import Exercise
from lapp.models.system_data import User
from lapp.services import LessonService, ReviewService


def _seed(db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="alice", email="alice@example.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id="user_U1", name="Japanese", target_iso639_2t="jpn"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", language_id="lang_L1", user_id="user_U1", title="Basics"), session=s, commit=False)


def test_review_includes_exercises_and_lesson_title(db):
    _seed(db)
    with db.session_scope() as s:
        db.insert(Exercise(id="ex_E1", lesson_id="lesson_L1", exercise_type="quizz", question="Q?", answer="A"), session=s, commit=False)

    cards = ReviewService().get_review_cards(language_id="lang_L1", as_dict=True)
    assert any(c.get("exercise_type") == "quizz" for c in cards)
    assert all(c.get("lesson_title") == "Basics" for c in cards)


def test_lessons_sorted_oldest_first(db):
    _seed(db)
    with db.session_scope() as s:
        db.insert(Lesson(id="lesson_L2", language_id="lang_L1", user_id="user_U1", title="newer", created_at=datetime.now()), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1b", language_id="lang_L1", user_id="user_U1", title="older", created_at=datetime.now() - timedelta(days=1)), session=s, commit=False)

    lessons = LessonService().get_all(language_id="lang_L1", as_dict=True)
    assert [l["title"] for l in lessons] == ["older", "Basics", "newer"]
