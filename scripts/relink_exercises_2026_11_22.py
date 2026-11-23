"""One-off prod repair (spec 2026-11-22, EG-24): add the vocabulary / grammar / calligraphy links an exercise earns from its own text
(question, answer, support text, content), with the same inflection-aware matcher the parser and generator use. Add-only: no link is removed.
An exercise still without any link is flagged `review_reason = "no association found"` (kept, out of reviews) and listed. Dry-run by default.

    python scripts/relink_exercises_2026_11_22.py --url postgresql+psycopg://u:p@host/db --schema fluence_prod [--apply]
"""
import argparse
import json
import sys
from pathlib import Path

from sqlalchemy import create_engine, text

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from lapp.services.ingestion.exercises import link_to_elements   # noqa: E402

KINDS = {"related_vocabulary": ("exercise_vocabulary_link", "vocabulary_id"), "related_grammar": ("exercise_grammar_link", "grammar_id"),
         "related_calligraphy": ("exercise_calligraphy_link", "calligraphy_id")}
ELEMENTS = {"vocabulary": "SELECT v.id, w.word FROM vocabulary v JOIN word w ON w.id = v.word_id WHERE v.lesson_id = :l",
            "grammar": "SELECT id, title FROM grammar WHERE lesson_id = :l",
            "calligraphy": "SELECT c.id, ch.character FROM calligraphy c JOIN character ch ON ch.id = c.character_id WHERE c.lesson_id = :l"}


def relink(conn, apply: bool = False) -> dict:
    """{"added": links added, "flagged": [exercise ids left without any link]}; rolls back unless `apply`."""
    added, flagged, cache = 0, [], {}
    for ex in conn.execute(text("SELECT id, lesson_id, question, answer, text_support, content FROM exercise ORDER BY id")).mappings().all():
        lesson = ex["lesson_id"]
        if lesson not in cache:
            cache[lesson] = {k: [tuple(r) for r in conn.execute(text(q), {"l": lesson}).all()] for k, q in ELEMENTS.items()}
        el = cache[lesson]
        content = ex["content"] if not isinstance(ex["content"], str) else json.loads(ex["content"])
        found = link_to_elements({"question": ex["question"], "answer": ex["answer"], "text_support": ex["text_support"], "content": content},
                                 el["vocabulary"], el["grammar"], el["calligraphy"])
        for key, ids in found.items():
            table, col = KINDS[key]
            for i in ids:
                added += conn.execute(text(f"INSERT INTO {table} (exercise_id, {col}) VALUES (:e, :i) ON CONFLICT DO NOTHING"), {"e": ex["id"], "i": i}).rowcount
        if not any(conn.execute(text(f"SELECT 1 FROM {t} WHERE exercise_id = :e LIMIT 1"), {"e": ex["id"]}).first() for t, _c in KINDS.values()):
            flagged.append(ex["id"])
            conn.execute(text("UPDATE exercise SET review_reason = 'no association found' WHERE id = :e AND review_reason IS NULL"), {"e": ex["id"]})
    if not apply:
        conn.rollback()
    return {"added": added, "flagged": flagged}


if __name__ == "__main__":
    a = argparse.ArgumentParser()
    a.add_argument("--url", required=True); a.add_argument("--schema", default="public"); a.add_argument("--apply", action="store_true")
    args = a.parse_args()
    with create_engine(args.url, connect_args={"options": f"-c search_path={args.schema}"}).connect() as c:
        r = relink(c, args.apply)
        print(("APPLIED" if args.apply else "DRY RUN"), "links added:", r["added"], "| flagged, still unlinked:", len(r["flagged"]), r["flagged"][:30])
        if args.apply:
            c.commit()
