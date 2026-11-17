"""Load a Tatoeba download into the local corpus tables (`corpus_sentence`, `corpus_link`). The dataset is not committed.

Download `sentences.csv` and `links.csv` from https://tatoeba.org/downloads (CC BY 2.0 FR), unpack them into one folder, then:

    python scripts/load_tatoeba.py <folder>

Only sentences of the nine supported languages are kept. Safe to re-run: it replaces the corpus.
"""
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

BATCH = 5000


def load(folder: str) -> tuple[int, int]:
    from lapp.core.database import db_manager
    from lapp.core.languages import SUPPORTED
    from lapp.models.system_data import CorpusLink, CorpusSentence

    langs = {l.iso2 for l in SUPPORTED.values()}
    root = Path(folder)
    kept: set[int] = set()
    n_sentences = n_links = 0
    with db_manager.session_scope() as s:
        s.query(CorpusLink).delete()
        s.query(CorpusSentence).delete()
        rows = []
        with open(root / "sentences.csv", encoding="utf-8", newline="") as f:
            for sid, lang, text in csv.reader(f, delimiter="\t", quoting=csv.QUOTE_NONE):
                if lang in langs:
                    kept.add(int(sid))
                    rows.append({"id": int(sid), "lang": lang, "text": text})
                    if len(rows) >= BATCH:
                        s.bulk_insert_mappings(CorpusSentence, rows); n_sentences += len(rows); rows = []
        if rows:
            s.bulk_insert_mappings(CorpusSentence, rows); n_sentences += len(rows)
        rows = []
        with open(root / "links.csv", encoding="utf-8", newline="") as f:
            for a, b in csv.reader(f, delimiter="\t", quoting=csv.QUOTE_NONE):
                if int(a) in kept and int(b) in kept:
                    rows.append({"sentence_id": int(a), "translation_id": int(b)})
                    if len(rows) >= BATCH:
                        s.bulk_insert_mappings(CorpusLink, rows); n_links += len(rows); rows = []
        if rows:
            s.bulk_insert_mappings(CorpusLink, rows); n_links += len(rows)
    return n_sentences, n_links


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        raise SystemExit(1)
    sentences, links = load(sys.argv[1])
    print(f"loaded {sentences} sentences and {links} links")
