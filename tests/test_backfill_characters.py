"""scripts/backfill_characters_2026_11_22.py: strokes come from shipped stroke data, radicals link only to existing characters, nothing is invented."""
import json
import sys
from pathlib import Path

from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from backfill_characters_2026_11_22 import backfill                # noqa: E402
from test_study_goal import _seed                                  # noqa: E402
from lapp.models.components import Character                       # noqa: E402


def test_strokes_from_data_radical_links_only_to_existing_characters(db, tmp_path):
    (tmp_path / "水.json").write_text(json.dumps({"strokes": ["a", "b", "c", "d"], "medians": []}), encoding="utf-8")
    _seed(db, n=1)
    with db.session_scope() as s:
        db.insert(Character(id="char_W", language_id="lang_L1", character="水", radical="氵"), session=s, commit=False)
        db.insert(Character(id="char_R", language_id="lang_L1", character="氵"), session=s, commit=False)
        db.insert(Character(id="char_X", language_id="lang_L1", character="火", radical="Pictogramme"), session=s, commit=False)
    with db.session_scope() as s:
        conn = s.connection()
        out = backfill(conn, tmp_path, apply=True)
        assert out["strokes_set"] == 1 and "火" in out["strokes_missing"] and out["radical_linked"] == 1 and out["radical_text_left"] == 1
        assert conn.execute(text("SELECT strokes, key_radical_id FROM \"character\" WHERE id = 'char_W'")).one() == (4, "char_R")
        assert conn.execute(text("SELECT strokes, key_radical_id FROM \"character\" WHERE id = 'char_X'")).one() == (None, None)    # never guessed
        assert backfill(conn, tmp_path, apply=True)["strokes_set"] == 0                                                            # idempotent
