"""Daily review (exercises included, lesson title attached) and stable lesson ordering."""
from datetime import datetime, timedelta

from conftest import link_all_exercises
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

    link_all_exercises(db_manager)
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


def _voc(db, n):
    from lapp.models.components import Word
    from lapp.models.features import Vocabulary
    with db.session_scope() as s:
        for i in range(n):
            db.insert(Word(id=f"word_W{i}", language_id="lang_L1", word=f"w{i}"), session=s, commit=False)
            db.insert(Vocabulary(id=f"voc_V{i}", lesson_id="lesson_L1", word_id=f"word_W{i}"), session=s, commit=False)


def test_vocabulary_emitted_per_side(db):
    _seed(db)
    _voc(db, 1)
    cards = ReviewService().get_review_cards(language_id="lang_L1", as_dict=True)
    voc = [c for c in cards if "word" in c]
    assert sorted(c["side"] for c in voc) == ["back", "front"]
    assert {c["card_id"] for c in voc} == {"voc_V0#front", "voc_V0#back"}


def test_harder_side_ranked_first(db):
    from lapp.services.system_data import ScoreService
    _seed(db)
    _voc(db, 1)
    ScoreService().set("user_U1", "voc_V0#back", score=0.0, difficulty=0.95)
    ScoreService().set("user_U1", "voc_V0#front", score=0.0, difficulty=0.1)
    voc = [c for c in ReviewService().get_review_cards(language_id="lang_L1", as_dict=True) if "word" in c]
    assert voc[0]["side"] == "back"


def test_sibling_sides_kept_apart(db):
    _seed(db)
    _voc(db, 6)
    cards = ReviewService().get_review_cards(language_id="lang_L1", as_dict=True)
    voc_stream = [c["id"] for c in cards if "word" in c]
    # the tail is forced (only siblings are left), so check the first 8 cards
    for vid in set(voc_stream):
        a, b = [i for i, x in enumerate(voc_stream) if x == vid]
        if b < 8:
            assert b - a > 3


def test_single_vocabulary_does_not_hang(db):
    _seed(db)
    _voc(db, 1)
    assert len([c for c in ReviewService().get_review_cards(language_id="lang_L1", as_dict=True) if "word" in c]) == 2
