"""One-off prod repair (spec 2026-11-22, CA-11): fill the stroke count and the key radical link of characters, never inventing.

* strokes: from the stroke data the app already ships for drawing (`hanzi-writer-data`, one JSON per glyph; the count is its number of strokes).
  A glyph without data (shin-jitai kanji, letters) stays empty and is listed.
* radical: a character whose free-text `radical` is one glyph that already exists as a Character of the same language (and is not itself) gets it as
  `key_radical_id`; nothing is created, descriptive text ("Pictogramme", "-") stays text and is listed.
Only fills what is empty. Dry-run by default.

    python scripts/backfill_characters_2026_11_22.py --url postgresql+psycopg://u:p@host/db --schema fluence_prod [--data client/node_modules/hanzi-writer-data] [--apply]
"""
import argparse
import json
from pathlib import Path

from sqlalchemy import create_engine, text

DATA = Path(__file__).resolve().parent.parent / "client" / "node_modules" / "hanzi-writer-data"


def stroke_count(glyph: str, data: Path) -> int | None:
    path = data / f"{glyph}.json"
    return len(json.loads(path.read_text(encoding="utf-8"))["strokes"]) if len(glyph) == 1 and path.is_file() else None


def backfill(conn, data: Path = DATA, apply: bool = False) -> dict:
    out = {"strokes_set": 0, "strokes_missing": [], "radical_linked": 0, "radical_text_left": 0}
    for cid, glyph in conn.execute(text('SELECT id, "character" FROM "character" WHERE strokes IS NULL ORDER BY id')).all():
        n = stroke_count(glyph, data)
        if n:
            conn.execute(text('UPDATE "character" SET strokes = :n WHERE id = :i'), {"n": n, "i": cid}); out["strokes_set"] += 1
        else:
            out["strokes_missing"].append(glyph)
    out["radical_linked"] = conn.execute(text(
        'UPDATE "character" c SET key_radical_id = r.id FROM "character" r WHERE c.key_radical_id IS NULL AND c.radical IS NOT NULL AND c.radical <> \'\' '
        'AND r.language_id = c.language_id AND r."character" = c.radical AND r.id <> c.id')).rowcount
    out["radical_text_left"] = conn.execute(text('SELECT COUNT(*) FROM "character" WHERE key_radical_id IS NULL AND radical IS NOT NULL AND radical <> \'\'')).scalar()
    if not apply:
        conn.rollback()
    return out


if __name__ == "__main__":
    a = argparse.ArgumentParser()
    a.add_argument("--url", required=True); a.add_argument("--schema", default="public"); a.add_argument("--data", type=Path, default=DATA); a.add_argument("--apply", action="store_true")
    args = a.parse_args()
    with create_engine(args.url, connect_args={"options": f"-c search_path={args.schema}"}).connect() as c:
        r = backfill(c, args.data, args.apply)
        print("APPLIED" if args.apply else "DRY RUN", {k: (v if not isinstance(v, list) else f"{len(v)}: {''.join(v[:40])}") for k, v in r.items()})
        if args.apply:
            c.commit()
