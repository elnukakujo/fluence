"""Load the read-only radical catalogue from a CSV (columns: language_iso, character, phonetic, meaning, strokes).
Does nothing without a file: the data source is TODO(owner). Re-running updates existing rows.

    python scripts/load_radical_catalogue.py radicals.csv
"""
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))


def load(path: str) -> int:
    from lapp.core.database import db_manager
    from lapp.models.components import RadicalCatalogue
    n = 0
    with db_manager.session_scope() as s:
        for row in csv.DictReader(open(path, encoding="utf-8")):
            entry = s.query(RadicalCatalogue).filter_by(language_iso=row["language_iso"], character=row["character"]).first() \
                or RadicalCatalogue(language_iso=row["language_iso"], character=row["character"])
            entry.phonetic, entry.meaning = row.get("phonetic") or None, row.get("meaning") or None
            entry.strokes = int(row["strokes"]) if row.get("strokes") else None
            s.add(entry)
            n += 1
    return n


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(0)
    print(f"loaded {load(sys.argv[1])} radicals")
