"""One aggregate for every parent score (spec 2 Task 5)."""
import pytest

from lapp.models.system_data import User
from lapp.models.containers import Language, Lesson
from lapp.models.components import Word
from lapp.models.features import Vocabulary
from lapp.services.containers import LessonService
from lapp.services.system_data import ScoreService
from lapp.services.system_data.score_cascade import ChildScore, aggregate


def c(**skills):
    return ChildScore(skills)


def test_coverage_and_mean_of_seen_are_separate():
    a = aggregate([c(recall=80), c(recall=80), c(recall=80), c()])
    assert a.coverage == 0.75 and a.mean_seen == 80 and a.score == 60


def test_enabling_an_unanswered_skill_changes_nothing():
    kids = [c(recall=80), c(recall=60)]
    assert aggregate(kids, {"recall"}) == aggregate(kids, {"recall", "recognition"})


def test_disabling_a_skill_drops_it_from_the_mean_instead_of_zero_filling():
    both = [c(recall=90, recognition=30)]
    assert aggregate(both).score == 60
    assert aggregate(both, {"recall"}).score == 90          # not (90 + 0) / 2


def test_a_child_with_no_enabled_answered_skill_counts_zero_and_is_not_seen():
    a = aggregate([c(recognition=100), c(recall=100)], {"recall"})
    assert (a.score, a.coverage, a.mean_seen) == (50, 0.5, 100)


def test_no_children():
    assert aggregate([]).score == 0 and aggregate([]).difficulty == 0.5


def _seed(db, n=3):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id="user_U1", name="J", target_iso639_2t="jpn", source_iso639_2t="eng"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="L1"), session=s, commit=False)
        for i in range(n):
            db.insert(Word(id=f"word_W{i}", language_id="lang_L1", word=f"w{i}"), session=s, commit=False)
            db.insert(Vocabulary(id=f"voc_V{i}", lesson_id="lesson_L1", word_id=f"word_W{i}"), session=s, commit=False)


def test_lesson_score_is_rounded_to_one_decimal(db):
    _seed(db)
    ScoreService().set("user_U1", "voc_V0", 10.0, 0.5)
    assert LessonService().update_score("lesson_L1", user_id="user_U1").score == 3.3      # 10 / 3


def test_word_averages_only_its_own_cards(db):
    _seed(db)
    from lapp.services.components import WordService
    ScoreService().set("user_U1", "voc_V0", 40.0, 0.5)
    ScoreService().set("user_U1", "voc_V1", 100.0, 0.5)      # another word's card: no effect
    assert WordService().update_score("word_W0", user_id="user_U1").score == pytest.approx(40.0, abs=0.01)


def test_passage_cannot_be_scored_directly(app, db):
    from lapp.services.auth import AuthService
    _seed(db)
    c = app.test_client()
    c.set_cookie("session_token", AuthService().create_session("user_U1", remember=False))
    r = c.post("/api/passage/score", json={"passage_id": "pass_P1", "similarity": 1, "skill": "recall",
                                           "evidence_type": "typed", "duration_ms": 1})
    assert r.status_code == 405
