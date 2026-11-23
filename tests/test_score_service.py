"""ScoreService: per-user, per-skill record/get/get_many/merge on the engine."""
from datetime import datetime, timedelta

import pytest

from lapp.services.system_data import ScoreService
from lapp.models.system_data import User, Score


def _seed_users(db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(User(id="user_U2", username="b", email="b@x.com"), session=s, commit=False)


def _age(db, element_id, days):
    with db.session_scope() as s:
        for r in s.query(Score).filter(Score.element_id == element_id):
            r.last_seen_at = datetime.now() - timedelta(days=days)


def test_first_answer_creates_the_row_with_stability(db):
    _seed_users(db)
    s = ScoreService().record("user_U1", "voc_V1", "recall", 1.0, "typed")
    assert s.score == pytest.approx(28) and s.stability == 10 and s.skill == "recall"
    created_at = s.created_at
    s2 = ScoreService().record("user_U1", "voc_V1", "recall", 1.0, "typed")
    assert s2.id == s.id and s2.created_at == created_at     # same row, created_at set once
    assert s2.score == s.score and s2.stability == 10       # same day: the day's gain is capped and the stability does not double twice (SC-31)


def test_a_second_skill_gets_its_own_row(db):
    _seed_users(db)
    a = ScoreService().record("user_U1", "voc_V1", "recall", 1.0, "typed")
    b = ScoreService().record("user_U1", "voc_V1", "recognition", 0.0, "typed")
    assert a.id != b.id and a.score == pytest.approx(28) and b.score == 0
    assert ScoreService().get("user_U1", "voc_V1", skill="recall").score == pytest.approx(28)


def test_difficulty_follows_stability(db):
    _seed_users(db)
    s = ScoreService().record("user_U1", "voc_V1", "recall", 1.0, "typed")
    assert s.difficulty == pytest.approx(1 - 10 / 180, abs=1e-3)


def test_unknown_evidence_is_rejected(db):
    _seed_users(db)
    with pytest.raises(ValueError):
        ScoreService().record("user_U1", "voc_V1", "recall", 1.0, "telepathy")


def test_record_isolation(db):
    _seed_users(db)
    ScoreService().record("user_U1", "voc_V1", "recall", 1.0, "typed")
    ScoreService().record("user_U2", "voc_V1", "recall", 0.0, "typed")
    assert ScoreService().get("user_U1", "voc_V1").score == pytest.approx(28)
    assert ScoreService().get("user_U2", "voc_V1").score == 0


def test_get_many(db):
    _seed_users(db)
    ScoreService().record("user_U1", "gram_G1", "recognition", 1.0, "typed")
    ScoreService().record("user_U1", "gram_G2", "recognition", 0.8, "typed")
    m = ScoreService().get_many("user_U1", ["gram_G1", "gram_G2", "gram_G9"])
    assert m["gram_G1"].score > 0 and m["gram_G2"].score > 0
    assert "gram_G9" not in m   # unstarted -> no row


def test_reads_decay_without_writing(db):
    _seed_users(db)
    ScoreService().record("user_U1", "gram_G1", "recognition", 1.0, "typed")        # 28, stability 10
    _age(db, "gram_G1", 10)
    assert ScoreService().get("user_U1", "gram_G1").score == pytest.approx(14, abs=0.05)
    assert ScoreService().get("user_U1", "gram_G1", skill="recognition").score == pytest.approx(28)   # stored value untouched


def test_element_score_is_the_mean_of_its_skills(db):
    _seed_users(db)
    ScoreService().record("user_U1", "call_C1", "recall", 1.0, "typed")
    ScoreService().record("user_U1", "call_C1", "recognition", 1.0, "typed")
    ScoreService().record("user_U1", "call_C1", "recognition", 1.0, "typed")
    both = ScoreService().get("user_U1", "call_C1")
    a = ScoreService().get("user_U1", "call_C1", skill="recall").score
    b = ScoreService().get("user_U1", "call_C1", skill="recognition").score
    assert both.score == pytest.approx((a + b) / 2)


def test_merge_attaches_score_level_and_skills(db):
    _seed_users(db)
    ScoreService().record("user_U1", "gram_G1", "recognition", 1.0, "typed")
    out = ScoreService().merge("user_U1", [{"id": "gram_G1"}, {"id": "gram_G9"}])
    assert out[0]["score"] == pytest.approx(28)
    assert out[0]["score_level"] == "learning" and out[0]["weak"] is True and out[0]["is_leech"] is False
    assert out[0]["skills"]["recognition"]["score"] == pytest.approx(28)
    assert out[1]["score"] == 0.0 and out[1]["difficulty"] == 0.5
    assert out[1]["skills"] == {} and out[1]["score_level"] == "learning"


def test_set_note_reaches_every_skill_row(db):
    _seed_users(db)
    ScoreService().record("user_U1", "call_C1", "recall", 1.0, "typed")
    ScoreService().record("user_U1", "call_C1", "recognition", 1.0, "typed")
    ScoreService().set_note("user_U1", "call_C1", "my mnemonic")
    assert ScoreService().merge("user_U1", [{"id": "call_C1"}])[0]["note"] == "my mnemonic"
    ScoreService().set_note("user_U1", "call_C1", "")
    assert ScoreService().merge("user_U1", [{"id": "call_C1"}])[0]["note"] is None


def test_aggregate_rows_do_not_decay_on_their_own(db):
    _seed_users(db)
    ScoreService().set("user_U1", "lesson_L1", 50.0, 0.5)
    _age(db, "lesson_L1", 60)
    assert ScoreService().get("user_U1", "lesson_L1").score == 50.0     # derived value, refreshed by its children


def _set(db, element_id, skill, score):
    with db.session_scope() as s:
        s.query(Score).filter(Score.element_id == element_id, Score.skill == skill).one().score = score


def _practice(n, quality=1.0, eid="gram_G1"):
    for _ in range(n):
        ScoreService().record("user_U1", eid, "practice", quality, "typed")


def test_grammar_without_practice_row_reads_as_before(db):
    from datetime import date
    _seed_users(db)
    ScoreService().record("user_U1", "gram_G1", "recognition", 1.0, "self_grade")
    _set(db, "gram_G1", "recognition", 70)
    now = datetime.now()
    assert ScoreService().get_many("user_U1", ["gram_G1"])["gram_G1"].score == pytest.approx(70, abs=0.5)
    pi = ScoreService().priority_inputs("user_U1", ["gram_G1"], now, date.today())["gram_G1"]
    assert pi.weight == 1.0


def test_grammar_blend_uses_the_practice_row_after_five_answers(db):
    from datetime import date
    from lapp.utils.scoring import grammar_blend, GRAMMAR_FLOOR
    _seed_users(db)
    ScoreService().record("user_U1", "gram_G1", "recognition", 1.0, "self_grade")
    _set(db, "gram_G1", "recognition", 80)
    _practice(5)
    _set(db, "gram_G1", "practice", 70)
    got = ScoreService().get_many("user_U1", ["gram_G1"])["gram_G1"].score
    assert got == pytest.approx(GRAMMAR_FLOOR * 80 + (1 - GRAMMAR_FLOOR) * 70, abs=0.5)
    assert ScoreService().priority_inputs("user_U1", ["gram_G1"], datetime.now(), date.today())["gram_G1"].weight == pytest.approx(GRAMMAR_FLOOR)


def test_failed_exercises_keep_the_weight_at_one(db):
    from datetime import date
    _seed_users(db)
    ScoreService().record("user_U1", "gram_G1", "recognition", 1.0, "self_grade")
    _practice(6, quality=0.0)
    assert ScoreService().priority_inputs("user_U1", ["gram_G1"], datetime.now(), date.today())["gram_G1"].weight == 1.0


def test_four_exercise_answers_do_not_replace_anything(db):
    from datetime import date
    _seed_users(db)
    ScoreService().record("user_U1", "gram_G1", "recognition", 1.0, "self_grade")
    _practice(4)
    _set(db, "gram_G1", "practice", 90)
    assert ScoreService().priority_inputs("user_U1", ["gram_G1"], datetime.now(), date.today())["gram_G1"].weight == 1.0


def test_skill_scores_of_a_grammar_is_one_entry_holding_the_blend(db):
    _seed_users(db)
    ScoreService().record("user_U1", "gram_G1", "recognition", 1.0, "self_grade")
    _practice(5)
    _set(db, "gram_G1", "practice", 60)
    sk = ScoreService().skill_scores("user_U1", ["gram_G1"])["gram_G1"]
    assert list(sk) == ["recognition"]
    assert sk["recognition"] == pytest.approx(ScoreService().get_many("user_U1", ["gram_G1"])["gram_G1"].score)


def test_exercise_only_grammar_reads_as_its_practice_score(db):
    _seed_users(db)
    _practice(2)
    got = ScoreService().get_many("user_U1", ["gram_G1"])["gram_G1"].score
    assert got == pytest.approx(ScoreService().get("user_U1", "gram_G1", skill="practice").score, abs=0.5)
