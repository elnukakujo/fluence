"""scripts/repair_scores_2026_11_22.py: dead migration rows go, real rows of the chosen lessons reach Known, nothing else moves, a second run is a no-op."""
import sys
from datetime import datetime
from pathlib import Path

from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from repair_scores_2026_11_22 import repair                        # noqa: E402
from test_study_goal import _seed                                  # noqa: E402
from lapp.models.system_data import Score                          # noqa: E402

OLD = datetime(2026, 3, 1)


def _row(db, s, user, element, skill, score=100.0, stability=2.0, recent=""):
    db.insert(Score(id=db.generate_new_id(Score, session=s), user_id=user, element_id=element, skill=skill, score=score, difficulty=0.5,
                    stability=stability, recent=recent, created_at=OLD, last_seen_at=OLD), session=s, commit=False)


def test_repair_removes_dead_rows_lifts_real_ones_and_is_idempotent(db):
    _seed(db, n=3)
    with db.session_scope() as s:
        for who in ("user_U1", "user_U2"):
            _row(db, s, who, "voc_V0", "recall"); _row(db, s, who, "voc_V0", "recognition")                 # dead parent rows
            _row(db, s, who, "voc_V0#front", "recognition", score=10.0); _row(db, s, who, "voc_V0#front", "recall")   # real + dead skill
            _row(db, s, who, "voc_V0#back", "recall", score=10.0, recent="1"); _row(db, s, who, "voc_V0#back", "recognition", recent="1")   # answered: kept
    with db.session_scope() as s:
        conn = s.connection()
        first = repair(conn, "user_U1", "lang_L1", apply=True)
        assert first == {"dead_parents": 2, "dead_side_skills": 1, "lifted": 2}
        assert repair(conn, "user_U1", "lang_L1", apply=True) == {"dead_parents": 0, "dead_side_skills": 0, "lifted": 0}
        rows = {(r[0], r[1]): (r[2], r[3]) for r in conn.execute(text("SELECT user_id, element_id || '/' || skill, score, stability FROM score"))}
        assert rows[("user_U1", "voc_V0#front/recognition")] == (65.0, 20.0) and rows[("user_U1", "voc_V0#back/recall")] == (65.0, 20.0)
        assert ("user_U1", "voc_V0/recall") not in rows and ("user_U1", "voc_V0#front/recall") not in rows
        assert ("user_U1", "voc_V0#back/recognition") in rows                       # answered rows are never deleted
        assert rows[("user_U2", "voc_V0#front/recognition")] == (10.0, 2.0) and ("user_U2", "voc_V0/recall") in rows   # another user untouched
