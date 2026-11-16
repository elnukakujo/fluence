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
    assert s.score == pytest.approx(7.5) and s.stability == 4 and s.skill == "recall"
    created_at = s.created_at
    s2 = ScoreService().record("user_U1", "voc_V1", "recall", 1.0, "typed")
    assert s2.id == s.id and s2.created_at == created_at     # same row, created_at set once
    assert s2.score > s.score and s2.stability == 8


def test_a_second_skill_gets_its_own_row(db):
    _seed_users(db)
    a = ScoreService().record("user_U1", "voc_V1", "recall", 1.0, "typed")
    b = ScoreService().record("user_U1", "voc_V1", "recognition", 0.0, "typed")
    assert a.id != b.id and a.score == pytest.approx(7.5) and b.score == 0
    assert ScoreService().get("user_U1", "voc_V1", skill="recall").score == pytest.approx(7.5)


def test_difficulty_follows_stability(db):
    _seed_users(db)
    s = ScoreService().record("user_U1", "voc_V1", "recall", 1.0, "typed")
    assert s.difficulty == pytest.approx(1 - 4 / 180, abs=1e-3)


def test_unknown_evidence_is_rejected(db):
    _seed_users(db)
    with pytest.raises(ValueError):
        ScoreService().record("user_U1", "voc_V1", "recall", 1.0, "telepathy")


def test_record_isolation(db):
    _seed_users(db)
    ScoreService().record("user_U1", "voc_V1", "recall", 1.0, "typed")
    ScoreService().record("user_U2", "voc_V1", "recall", 0.0, "typed")
    assert ScoreService().get("user_U1", "voc_V1").score == pytest.approx(7.5)
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
    ScoreService().record("user_U1", "gram_G1", "recognition", 1.0, "typed")        # 7.5, stability 4
    _age(db, "gram_G1", 4)
    assert ScoreService().get("user_U1", "gram_G1").score == pytest.approx(3.75, abs=0.05)
    assert ScoreService().get("user_U1", "gram_G1", skill="recognition").score == pytest.approx(7.5)   # stored value untouched


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
    assert out[0]["score"] == pytest.approx(7.5)
    assert out[0]["score_level"] == "learning" and out[0]["weak"] is True and out[0]["is_leech"] is False
    assert out[0]["skills"]["recognition"]["score"] == pytest.approx(7.5)
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
