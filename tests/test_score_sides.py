"""Per-side vocabulary scoring per skill: parent = mean of the two sides (SC-15), unreviewed side counts 0."""
import pytest

from lapp.services.system_data import ScoreService
from lapp.models.system_data import User


def _seed(db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)


def test_one_side_moves_the_parent_by_half(db):
    _seed(db)
    parent = ScoreService().record_side("user_U1", "voc_B", "front", "recognition", 1.0, "typed")
    assert parent.score == pytest.approx(7.5 / 2)               # the other side counts 0


def test_parent_is_the_mean_of_the_sides(db):
    _seed(db)
    ScoreService().record_side("user_U1", "voc_B", "front", "recognition", 1.0, "typed")
    parent = ScoreService().record_side("user_U1", "voc_B", "back", "recall", 0.75, "typed")
    sides = ScoreService().get_sides("user_U1", "voc_B")
    assert parent.score == pytest.approx((sides["front"].score + sides["back"].score) / 2, abs=1e-3)
    assert parent.difficulty == pytest.approx((sides["front"].difficulty + sides["back"].difficulty) / 2, abs=1e-3)


def test_parent_is_per_skill_then_averaged(db):
    _seed(db)
    for side in ("front", "back"):
        ScoreService().record_side("user_U1", "voc_B", side, "recall", 1.0, "typed")
    ScoreService().record_side("user_U1", "voc_B", "front", "recognition", 0.0, "typed")
    out = ScoreService().merge("user_U1", [{"id": "voc_B"}])[0]
    assert out["skills"]["recall"]["score"] == pytest.approx(7.5)             # (7.5 + 7.5) / 2
    assert out["skills"]["recognition"]["score"] == pytest.approx(0)          # (0 + 0) / 2
    assert out["score"] == pytest.approx(7.5 / 2)
    assert out["front_score"] == pytest.approx(3.75) and out["back_score"] == pytest.approx(7.5)   # a side averages the skills it carries


def test_clamped(db):
    _seed(db)
    for _ in range(60):
        ScoreService().record_side("user_U1", "voc_B", "front", "recall", 1.0, "typed")
    f = ScoreService().get_sides("user_U1", "voc_B")["front"]
    assert f.score <= 100 and 0 <= f.difficulty <= 1
    for _ in range(60):
        ScoreService().record_side("user_U1", "voc_B", "front", "recall", 0.0, "typed")
    f = ScoreService().get_sides("user_U1", "voc_B")["front"]
    assert f.score >= 0 and 0 <= f.difficulty <= 1


def test_unreviewed_side_defaults(db):
    _seed(db)
    ScoreService().record_side("user_U1", "voc_B", "front", "recognition", 1.0, "typed")
    sides = ScoreService().get_sides("user_U1", "voc_B")
    assert sides["front"] is not None and sides["back"] is None


def test_bad_side_raises(db):
    _seed(db)
    with pytest.raises(ValueError):
        ScoreService().record_side("user_U1", "voc_B", "left", "recall", 0.5, "typed")
