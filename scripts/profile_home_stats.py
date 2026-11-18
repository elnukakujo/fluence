"""Where does one `home_stats.home()` call spend its time?

    uv run python scripts/profile_home_stats.py [--vocab 800 --grammar 140 --calligraphy 100 --languages 1]

Runs on the TEST schema (`fluence_test`, dropped and recreated like the pytest fixtures) with synthetic data the size of
the test VM's (about 800 vocabulary, 140 grammar), so it never touches dev or prod. Prints SQL statement count and the
top functions by cumulative time for a cold and a warm call.
"""
import argparse
import cProfile
import pstats
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from sqlalchemy import event  # noqa: E402

from lapp.api.app import create_app  # noqa: E402
from lapp.core.database import db_manager  # noqa: E402
from lapp.models.components import Character, Word  # noqa: E402
from lapp.models.containers import Language, Lesson  # noqa: E402
from lapp.models.features import Calligraphy, Grammar, Vocabulary  # noqa: E402
from lapp.models.system_data import User  # noqa: E402
from lapp.services.data_collection import home_stats  # noqa: E402
from lapp.services.system_data import ScoreService  # noqa: E402

U = "user_U1"


def seed(languages: int, vocab: int, grammar: int, calligraphy: int) -> None:
    with db_manager.session_scope() as s:
        db_manager.insert(User(id=U, username="u", email="u@x.com"), session=s, commit=False)
        for k in range(languages):
            lang = f"lang_L{k}"
            db_manager.insert(Language(id=lang, user_id=U, name=f"L{k}", target_iso639_2t="jpn"), session=s, commit=False)
            lessons = [f"lesson_{k}_{i}" for i in range(30)]
            for i, lid in enumerate(lessons):
                db_manager.insert(Lesson(id=lid, user_id=U, language_id=lang, title=lid, position=i), session=s, commit=False)
            for i in range(vocab):
                db_manager.insert(Word(id=f"word_W{k}_{i}", language_id=lang, word=f"w{i}"), session=s, commit=False)
                db_manager.insert(Vocabulary(id=f"voc_V{k}_{i}", lesson_id=lessons[i % 30], word_id=f"word_W{k}_{i}"), session=s, commit=False)
            for i in range(grammar):
                db_manager.insert(Grammar(id=f"gram_G{k}_{i}", lesson_id=lessons[i % 30], title=f"g{i}", explanation="e"), session=s, commit=False)
            for i in range(calligraphy):
                db_manager.insert(Character(id=f"char_C{k}_{i}", language_id=lang, character=f"c{i}"), session=s, commit=False)
                db_manager.insert(Calligraphy(id=f"call_C{k}_{i}", lesson_id=lessons[i % 30], character_id=f"char_C{k}_{i}"), session=s, commit=False)
    for k in range(languages):                                   # half of the vocabulary and grammar already seen
        for i in range(0, vocab, 2):
            ScoreService().set(U, f"voc_V{k}_{i}", score=40.0 + i % 50, difficulty=0.5)
        for i in range(0, grammar, 2):
            ScoreService().set(U, f"gram_G{k}_{i}", score=30.0 + i % 50, difficulty=0.5)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--languages", type=int, default=1)
    p.add_argument("--vocab", type=int, default=800)
    p.add_argument("--grammar", type=int, default=140)
    p.add_argument("--calligraphy", type=int, default=100)
    p.add_argument("--sort", default="cumulative", help="pstats sort key: cumulative or tottime")
    a = p.parse_args()

    app = create_app(config_name="test")
    with app.app_context():
        db_manager.drop_tables()
        db_manager.create_tables()
        db_manager.engine.dispose()
        seed(a.languages, a.vocab, a.grammar, a.calligraphy)

        count = [0]
        event.listen(db_manager.engine, "before_cursor_execute", lambda *_: count.__setitem__(0, count[0] + 1))
        for label in ("cold", "warm"):
            count[0] = 0
            prof = cProfile.Profile()
            t0 = time.perf_counter()
            prof.runcall(home_stats.home, U, "UTC")
            print(f"\n=== {label}: {time.perf_counter() - t0:.2f}s, {count[0]} SQL statements ===")
            if label == "warm":
                pstats.Stats(prof).sort_stats(a.sort).print_stats(25)


if __name__ == "__main__":
    main()
