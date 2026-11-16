"""Three named levels replace the seven statuses: boundaries, no `status` key, `level` of containers untouched."""
import pytest

from lapp.services.system_data import ScoreService
from lapp.models.system_data import User, Score
from lapp.utils import scoring


@pytest.mark.parametrize("score,level,weak", [
    (0, "learning", True), (39.9, "learning", True), (40, "learning", False), (59.9, "learning", False),
    (60, "known", False), (84.9, "known", False), (85, "mastered", False), (100, "mastered", False)])
def test_level_and_weak_at_each_boundary(db, score, level, weak):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        row = Score(id="score_S1", user_id="user_U1", element_id="gram_G1", skill="recognition", score=score,
                    difficulty=0.5, stability=180)
        s.add(row)
    out = ScoreService().merge("user_U1", [{"id": "gram_G1"}])[0]
    assert (out["score_level"], out["weak"]) == (level, weak)
    assert "status" not in out


def test_merge_keeps_the_container_level_index(db):
    out = ScoreService().merge("user_U1", [{"id": "lang_L1", "level": 3}])[0]
    assert out["level"] == 3 and out["score_level"] == "learning"


def test_status_for_is_gone():
    from lapp.utils import helpers
    assert not hasattr(helpers, "status_for") and hasattr(scoring, "level_for")


def test_merge_exposes_the_stability_that_sets_the_fading_estimate(db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
    ScoreService().record("user_U1", "gram_G1", "recognition", 1.0, "typed")
    out = ScoreService().merge("user_U1", [{"id": "gram_G1"}, {"id": "gram_G9"}])
    assert out[0]["stability"] == 4 and out[1]["stability"] is None
