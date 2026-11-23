"""Spec 2 acceptance scenarios that need no browser: the numbers the manual UI test expects, over HTTP, exact."""
import pytest

from lapp.models.system_data import Score
from lapp.models.components import Word
from lapp.models.containers import Language, Lesson
from lapp.models.features import Vocabulary
from lapp.models.system_data import User
from lapp.services.auth import AuthService

OK = {"vocabulary_id": "voc_V1", "similarity": 0.8, "skill": "recall", "evidence_type": "typed", "duration_ms": 5}


def _client(app, db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id="user_U1", name="Japanese", target_iso639_2t="jpn", source_iso639_2t="eng"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="L1"), session=s, commit=False)
        db.insert(Word(id="word_W1", language_id="lang_L1", word="水"), session=s, commit=False)
        db.insert(Vocabulary(id="voc_V1", lesson_id="lesson_L1", word_id="word_W1"), session=s, commit=False)
    c = app.test_client()
    c.set_cookie("session_token", AuthService().create_session("user_U1", remember=False))
    return c


def _answer(c, side, **kw):
    return c.post("/api/vocabulary/score", json={**OK, "side": side, "skill": "recognition" if side == "front" else "recall", **kw})


def _page(c):
    return c.get("/api/vocabulary/voc_V1").get_json()


def test_front_answer_gives_28_14_and_two_side_rows_no_parent_row(app, db):
    c = _client(app, db)
    assert _answer(c, "front", similarity=1.0).status_code == 200
    p = _page(c)
    assert p["front_score"] == pytest.approx(28) and p["back_score"] == 0 and p["score"] == pytest.approx(14)
    assert p["score_level"] == "learning" and p["stability"] == pytest.approx(4.0) and p["is_leech"] is False
    assert "status" not in p and set(p["skills"]) >= {"recognition"}
    with db.session_scope() as s:
        assert sorted((r.element_id, r.skill) for r in s.query(Score).filter(Score.element_id.like("voc_V1%"))) == [("voc_V1#front", "recognition")]


def test_a_grade_button_answer_weighs_0_8(app, db):
    c = _client(app, db)
    _answer(c, "front", similarity=1.0, evidence_type="self_grade")
    assert _page(c)["front_score"] == pytest.approx(24.0) and _page(c)["score"] == pytest.approx(12.0)   # 0.8 x 0.3 x 100


def test_back_answer_then_overall_is_the_mean_of_the_sides(app, db):
    c = _client(app, db)
    _answer(c, "front", similarity=1.0)
    _answer(c, "back", similarity=1.0)
    p = _page(c)
    assert p["score"] == pytest.approx((p["front_score"] + p["back_score"]) / 2, abs=0.1)   # the sides are shown rounded, the parent is not
    assert p["back_score"] > 0


def test_same_day_gain_is_capped_at_28_and_a_wrong_answer_is_not(app, db):
    c = _client(app, db)
    for _ in range(6):
        _answer(c, "front", similarity=1.0)
    assert _page(c)["front_score"] == pytest.approx(28.0)       # one perfect answer is already 30: capped per day
    _answer(c, "front", similarity=0.0)
    assert _page(c)["front_score"] < 28.0


def test_four_wrong_answers_flag_a_leech_and_three_right_clear_it(app, db):
    c = _client(app, db)
    for _ in range(4):
        _answer(c, "front", similarity=0.0)
    assert _page(c)["is_leech"] is True
    for _ in range(3):
        _answer(c, "front", similarity=1.0)
    assert _page(c)["is_leech"] is False
