"""Pure scoring engine: decay on read, stability, evidence weights, day cap, levels, leech."""
from dataclasses import replace
from datetime import date, datetime, timedelta, timezone

import pytest

from lapp.utils.scoring import (
    EVIDENCE_WEIGHTS, ScoreState, apply_answer, effective_score, is_weak, level_for,
    grammar_blend, grammar_weight, is_replaced,
    grammar_blend, grammar_weight, is_replaced,
)

T0 = datetime(2026, 1, 1, 12, 0)
DAY = timedelta(days=1)


def fresh(**kw):
    return ScoreState(score=kw.pop("score", 0.0), stability=kw.pop("stability", 2.0),
                      last_seen_at=kw.pop("last_seen_at", None), recent="", is_leech=False,
                      day_date=None, day_gain=0.0, **kw)


@pytest.mark.parametrize("score,stab,days,expected", [
    (80, 2, 2, 40), (80, 8, 8, 40), (80, 2, 4, 20), (80, 32, 32, 40), (80, 2, 1, 80 * 0.5 ** 0.5),
    (80, 2, 0, 80),
])
def test_effective_score_halves_every_stability(score, stab, days, expected):
    assert effective_score(score, stab, T0, T0 + days * DAY) == pytest.approx(expected)


def test_no_decay_without_or_before_last_seen():
    assert effective_score(80, 2, None, T0) == 80                 # aggregate row created with touch=False
    assert effective_score(80, 2, T0 + 3 * DAY, T0) == 80         # clock skew: last_seen in the future


@pytest.mark.parametrize("s,level", [(0, "learning"), (39.99, "learning"), (40, "learning"), (59.99, "learning"),
                                     (60, "known"), (84.99, "known"), (85, "mastered"), (100, "mastered")])
def test_level_for_boundaries(s, level):
    assert level_for(s) == level


def test_weak_below_40():
    assert is_weak(39.99) and not is_weak(40)


def test_first_answer_on_unscored_item_does_not_crash():
    s = apply_answer(fresh(), 1.0, EVIDENCE_WEIGHTS["typed"], T0)
    assert s.score == pytest.approx(7.5) and s.stability == 4 and s.last_seen_at == T0


def test_stability_doubles_halves_and_caps():
    s = fresh()
    for want in (4, 8, 16, 32, 64, 128, 180, 180):
        s = apply_answer(s, 1.0, 1.0, T0 + DAY * 0)  # same instant: no decay
        assert s.stability == want
    w = apply_answer(fresh(stability=8), 0.0, 1.0, T0)
    assert w.stability == 4
    for _ in range(20):
        w = apply_answer(w, 0.0, 1.0, T0)
    assert w.stability > 0


def test_symmetric_delta_and_evidence_weight():
    base = fresh(score=50, last_seen_at=T0)
    up = apply_answer(base, 0.75, 1.0, T0).score - 50
    down = 50 - apply_answer(base, 0.25, 1.0, T0).score
    assert up == pytest.approx(down) and up > 0
    assert apply_answer(base, 0.5, 1.0, T0).score == pytest.approx(50)
    typed = apply_answer(base, 1.0, EVIDENCE_WEIGHTS["typed"], T0).score - 50
    self_grade = apply_answer(base, 1.0, EVIDENCE_WEIGHTS["self_grade"], T0).score - 50
    assert self_grade == pytest.approx(typed * 0.8)


def test_weights_table():
    assert EVIDENCE_WEIGHTS == {"typed": 1.0, "spoken": 1.0, "self_grade": 0.8, "multiple_choice": 0.6, "matching": 0.6}


def test_decay_applies_before_the_delta():
    s = apply_answer(fresh(score=80, stability=2, last_seen_at=T0), 0.5, 1.0, T0 + 2 * DAY)
    assert s.score == pytest.approx(40)


def test_same_day_gain_capped_losses_not():
    s = fresh(score=0, last_seen_at=T0)
    for _ in range(10):
        s = apply_answer(s, 1.0, 1.0, T0)
    assert s.score == pytest.approx(15)
    lost = apply_answer(s, 0.0, 1.0, T0)
    assert lost.score == pytest.approx(15 - 7.5)
    nxt = apply_answer(s, 1.0, 1.0, T0 + DAY)  # next learner-local day: cap resets
    assert nxt.score > s.score


def test_cap_resets_at_learner_local_midnight():
    tz = timezone(timedelta(hours=9))
    late_utc = datetime(2026, 1, 1, 14, 30, tzinfo=timezone.utc)   # 23:30 local (+9)
    s = fresh(score=0, last_seen_at=late_utc)
    for _ in range(5):
        s = apply_answer(s, 1.0, 1.0, late_utc, tz)
    assert s.score == pytest.approx(15) and s.day_date == date(2026, 1, 1)
    after = apply_answer(s, 1.0, 1.0, late_utc + timedelta(hours=1), tz)  # 00:30 local, new day
    assert after.day_date == date(2026, 1, 2) and after.score == pytest.approx(15 + 7.5, abs=0.2)


def test_leech_enters_on_fourth_wrong_in_last_eight_and_leaves_after_three_correct():
    s = fresh(score=50, last_seen_at=T0)
    for _ in range(3):
        s = apply_answer(s, 0.0, 1.0, T0)
    assert not s.is_leech
    s = apply_answer(s, 0.0, 1.0, T0)
    assert s.is_leech
    s = apply_answer(s, 1.0, 1.0, T0); s = apply_answer(s, 1.0, 1.0, T0)
    assert s.is_leech                       # two in a row is not enough
    s = apply_answer(s, 1.0, 1.0, T0)
    assert not s.is_leech
    for _ in range(10):
        s = apply_answer(s, 1.0, 1.0, T0)
    assert len(s.recent) == 8 and set(s.recent) == {"1"}


def test_old_wrongs_outside_window_do_not_count():
    s = fresh(score=50, last_seen_at=T0)
    for _ in range(3):
        s = apply_answer(s, 0.0, 1.0, T0)
    for _ in range(6):
        s = apply_answer(s, 1.0, 1.0, T0)
    s = apply_answer(s, 0.0, 1.0, T0)
    assert not s.is_leech


def test_weight_is_one_without_enough_answers():
    assert grammar_weight(90, 4) == 1.0


def test_weight_is_one_when_practice_is_zero():
    assert grammar_weight(0, 8) == 1.0


def test_weight_slides_linearly_to_the_floor():
    assert grammar_weight(30, 5) == pytest.approx(0.55)
    assert grammar_weight(60, 5) == pytest.approx(0.10)
    assert grammar_weight(100, 8) == pytest.approx(0.10)


def test_blend_is_the_reading_alone_without_practice():
    assert grammar_blend(70, None, 0) == 70


def test_blend_mixes_by_weight():
    assert grammar_blend(80, 60, 5) == pytest.approx(0.1 * 80 + 0.9 * 60)


def test_is_replaced_only_at_the_floor():
    assert is_replaced(0.1) and not is_replaced(0.55) and not is_replaced(1.0)
