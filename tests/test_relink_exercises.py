"""scripts/relink_exercises_2026_11_22.py: links earned from the text are added (inflections too), nothing is removed, the rest is flagged."""
import sys
from pathlib import Path

from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from relink_exercises_2026_11_22 import relink                     # noqa: E402
from test_study_goal import _seed                                  # noqa: E402
from lapp.models.features import Exercise                          # noqa: E402


def test_relink_adds_earned_links_from_support_text_and_flags_the_rest(db):
    _seed(db, n=2)
    with db.session_scope() as s:
        db.insert(Exercise(id="ex_E1", lesson_id="lesson_A", exercise_type="reading", question="Read", answer="x", text_support="the text says w0 and g1", content=None,
                           image_files=[], audio_files=[]), session=s, commit=False)
        db.insert(Exercise(id="ex_E2", lesson_id="lesson_A", exercise_type="essay", question="Describe your day", answer="x", content=None,
                           image_files=[], audio_files=[]), session=s, commit=False)
    with db.session_scope() as s:
        conn = s.connection()
        out = relink(conn, apply=True)
        assert out["flagged"] == ["ex_E2"] and out["added"] == 2
        assert conn.execute(text("SELECT vocabulary_id FROM exercise_vocabulary_link WHERE exercise_id = 'ex_E1'")).scalars().all() == ["voc_V0"]
        assert conn.execute(text("SELECT grammar_id FROM exercise_grammar_link WHERE exercise_id = 'ex_E1'")).scalars().all() == ["gram_G1"]
        assert conn.execute(text("SELECT review_reason FROM exercise WHERE id = 'ex_E2'")).scalar() == "no association found"
        assert relink(conn, apply=True)["added"] == 0                                   # idempotent
