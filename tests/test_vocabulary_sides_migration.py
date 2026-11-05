"""Migration c1a7e4d9b2f6 seeds #front/#back rows from existing voc_ scores."""
import importlib.util
from datetime import datetime
from pathlib import Path

from sqlalchemy import text

from lapp.models.system_data import User, Score

_spec = importlib.util.spec_from_file_location(
    "mig", Path(__file__).parent.parent / "alembic/versions/c1a7e4d9b2f6_vocabulary_sides.py")
mig = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mig)


def _seed(db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(Score(id="sc_S1", user_id="user_U1", element_id="voc_V1", score=40.0, difficulty=0.7,
                        created_at=datetime(2026, 1, 1), last_seen_at=datetime(2026, 2, 1)), session=s, commit=False)
        db.insert(Score(id="sc_S2", user_id="user_U1", element_id="gram_G1", score=10.0, difficulty=0.5,
                        created_at=datetime(2026, 1, 1)), session=s, commit=False)


def _rows(db):
    with db.session_scope() as s:
        return {r.element_id: r for r in s.query(Score)}


def test_seeds_both_sides_idempotently(db):
    _seed(db)
    for _ in range(2):
        with db.engine.begin() as conn:
            mig.seed_vocabulary_sides(conn)
    rows = _rows(db)
    assert set(rows) == {"voc_V1", "voc_V1#front", "voc_V1#back", "gram_G1"}
    for side in ("voc_V1#front", "voc_V1#back"):
        r = rows[side]
        assert (r.score, r.difficulty, r.created_at, r.last_seen_at) == (40.0, 0.7, datetime(2026, 1, 1), datetime(2026, 2, 1))
    assert len({r.id for r in rows.values()}) == 4
