"""SC-30 in the queue: a grammar the exercises replace fades from the daily queue, explicit scopes still serve it."""
from datetime import datetime

import pytest

from lapp.services import ReviewService  # services first: schemas<->services import cycle
from lapp.models.system_data import User, Score
from lapp.models.containers import Language, Lesson
from lapp.models.features import Grammar
from lapp.services.features.review_queue import Scope
from lapp.services.system_data import ScoreService

U = "user_U1"


def _seed(db, n=2):
    with db.session_scope() as s:
        db.insert(User(id=U, username="a", email="a@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id=U, name="J", target_iso639_2t="jpn"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id=U, language_id="lang_L1", title="L1", position=1), session=s, commit=False)
        for i in range(n):
            db.insert(Grammar(id=f"gram_G{i}", lesson_id="lesson_L1", title=f"g{i}", explanation="e"), session=s, commit=False)


def _replace(db, gid, practice=70):
    """Reading 40, then five exercise answers at `practice`: the weight falls to the floor when practice >= the anchor."""
    ScoreService().record(U, gid, "recognition", 1.0, "self_grade")
    for _ in range(5):
        ScoreService().record(U, gid, "practice", 1.0, "typed")
    with db.session_scope() as s:
        s.query(Score).filter(Score.element_id == gid, Score.skill == "practice").one().score = practice


def _ids(scope=None):
    cards = ReviewService().get_review_cards(language_id="lang_L1", user_id=U, as_dict=True, scope=scope)
    return [c["id"] for c in cards if c.get("kind") == "grammar" or str(c["id"]).startswith("gram_")]


def test_replaced_grammar_is_not_in_the_daily_queue(db):
    _seed(db)
    _replace(db, "gram_G0")
    ids = _ids()
    assert "gram_G0" not in ids and "gram_G1" in ids


def test_replaced_grammar_is_still_served_by_explicit_scopes(db):
    _seed(db)
    _replace(db, "gram_G0")
    assert "gram_G0" in _ids(Scope(kind="lesson", lesson_id="lesson_L1"))
    assert "gram_G0" in _ids(Scope(kind="type", element_type="grammar"))


def test_half_replaced_grammar_stays_in_the_daily_queue(db):
    _seed(db)
    _replace(db, "gram_G0", practice=30)
    assert "gram_G0" in _ids()


def test_replaced_grammar_in_the_goal_menu_does_not_break_the_queue(db):
    from lapp.services.features import StudyGoalService
    _seed(db)
    _replace(db, "gram_G0")
    StudyGoalService().upsert(U, "lang_L1", "week", 0, 2, 0)     # a goal asking for grammar reviews
    assert "gram_G0" not in _ids()


def test_priority_scales_with_the_weight():
    from lapp.services.features.review_queue import priority_for
    from lapp.services.system_data.score import PriorityInput
    now = datetime.now()
    full = {"a": PriorityInput(score=20, stability=2, last_seen_at=None, lapses=0, weight=1.0)}
    half = {"a": PriorityInput(score=20, stability=2, last_seen_at=None, lapses=0, weight=0.5)}
    assert priority_for(half, "a", now) == pytest.approx(priority_for(full, "a", now) * 0.5)
