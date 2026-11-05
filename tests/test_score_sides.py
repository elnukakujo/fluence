"""Per-side vocabulary scoring: doubled steps, parent = average."""
import pytest

from lapp.services.system_data import ScoreService
from lapp.models.system_data import User


def _seed(db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)


def test_one_side_grade_moves_parent_by_one_old_step(db):
    _seed(db)
    old = ScoreService().record("user_U1", "voc_A", 0.8).score
    parent = ScoreService().record_side("user_U1", "voc_B", "front", 0.8)
    assert parent.score == pytest.approx(old, abs=1e-3)


def test_side_rows_created_and_parent_is_average(db):
    _seed(db)
    ScoreService().record_side("user_U1", "voc_B", "front", 0.8)
    parent = ScoreService().record_side("user_U1", "voc_B", "back", 0.5)
    sides = ScoreService().get_sides("user_U1", "voc_B")
    assert parent.score == pytest.approx((sides["front"].score + sides["back"].score) / 2, abs=1e-3)
    assert parent.difficulty == pytest.approx((sides["front"].difficulty + sides["back"].difficulty) / 2, abs=1e-3)


def test_clamped(db):
    _seed(db)
    for _ in range(60):
        ScoreService().record_side("user_U1", "voc_B", "front", 1.0)
    f = ScoreService().get_sides("user_U1", "voc_B")["front"]
    assert f.score <= 100 and 0 <= f.difficulty <= 1
    for _ in range(60):
        ScoreService().record_side("user_U1", "voc_B", "front", 0.0)
    f = ScoreService().get_sides("user_U1", "voc_B")["front"]
    assert f.score >= 0 and 0 <= f.difficulty <= 1


def test_unreviewed_side_defaults(db):
    _seed(db)
    ScoreService().record_side("user_U1", "voc_B", "front", 0.8)
    sides = ScoreService().get_sides("user_U1", "voc_B")
    assert sides["front"] is not None and sides["back"] is None


def test_bad_side_raises(db):
    _seed(db)
    with pytest.raises(ValueError):
        ScoreService().record_side("user_U1", "voc_B", "left", 0.5)
