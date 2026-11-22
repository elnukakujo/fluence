"""scripts/dedupe_vocabulary_2026_11_22.py: Hallo / Hallo! become one entry that keeps the answers, links and exercises of both."""
import sys
from datetime import datetime
from pathlib import Path

from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from dedupe_vocabulary_2026_11_22 import dedupe                    # noqa: E402
from test_study_goal import _seed                                  # noqa: E402
from lapp.models.components import Word                           # noqa: E402
from lapp.models.features import Vocabulary                        # noqa: E402
from lapp.models.system_data import Score                          # noqa: E402


def test_punctuation_duplicates_merge_into_the_entry_with_most_answers(db):
    _seed(db, n=1)
    with db.session_scope() as s:
        db.insert(Word(id="word_W9", language_id="lang_L1", word="w0!"), session=s, commit=False)
        db.insert(Vocabulary(id="voc_V9", lesson_id="lesson_A", word_id="word_W9"), session=s, commit=False)
        for el, recent in (("voc_V9#front", "1111"), ("voc_V0#front", "1")):
            db.insert(Score(id=db.generate_new_id(Score, session=s), user_id="user_U1", element_id=el, skill="recognition", score=50.0, difficulty=0.5,
                            stability=5.0, recent=recent, created_at=datetime(2026, 1, 1)), session=s, commit=False)
    with db.session_scope() as s:
        conn = s.connection()
        done = dedupe(conn, "lesson_A", apply=True)
        assert [(d[0], d[2]) for d in done] == [("voc_V9", "voc_V0")]
        assert dedupe(conn, "lesson_A", apply=True) == []                                   # idempotent
        assert conn.execute(text("SELECT id FROM vocabulary WHERE lesson_id = 'lesson_A' ORDER BY id")).scalars().all() == ["voc_V9"]
        assert conn.execute(text("SELECT w.word FROM vocabulary v JOIN word w ON w.id = v.word_id WHERE v.id = 'voc_V9'")).scalar() == "w0"   # the stray mark is gone
        assert conn.execute(text("SELECT element_id || ':' || recent FROM score")).scalars().all() == ["voc_V9#front:1111"]
