"""One-off prod repair (spec 2026-11-22, EM-13): merge vocabulary of one lesson that differ only by case or end punctuation (Hallo / Hallo!).
Keeps the entry with the most answers, then the most exercise links; moves links, score rows, history and menu items onto it; deletes the other
entry and its word when nothing else uses it. Dry-run by default.

    python scripts/dedupe_vocabulary_2026_11_22.py --url postgresql+psycopg://u:p@host/db --schema fluence_prod --lesson lesson_L24 [--apply]
"""
import argparse
import re

from sqlalchemy import create_engine, text

_TAIL = re.compile(r"^[\W_]+|[\W_]+$")
LINKS = [("exercise_vocabulary_link", "exercise_id", "vocabulary_id"), ("vocabulary_example_sentence", "passage_id", "vocabulary_id"),
         ("source_element_link", "source_id", "element_id"), ("tag_element_link", "tag_id", "element_id")]


def key(word: str) -> str:
    return _TAIL.sub("", word.casefold())


def _evidence(conn, vid: str) -> tuple[int, int]:
    answers = conn.execute(text("SELECT COALESCE(SUM(LENGTH(recent)), 0) FROM score WHERE split_part(element_id, '#', 1) = :v"), {"v": vid}).scalar()
    return int(answers), conn.execute(text("SELECT COUNT(*) FROM exercise_vocabulary_link WHERE vocabulary_id = :v"), {"v": vid}).scalar()


def _merge(conn, keep: str, drop: str) -> None:
    p = {"k": keep, "d": drop}
    for table, other, col in LINKS:
        conn.execute(text(f"INSERT INTO {table} ({other}, {col}) SELECT {other}, :k FROM {table} WHERE {col} = :d ON CONFLICT DO NOTHING"), p)
        conn.execute(text(f"DELETE FROM {table} WHERE {col} = :d"), p)
    for suffix in ("", "#front", "#back"):          # per (user, skill): the row with more answers wins
        q = {"k": keep + suffix, "d": drop + suffix}
        conn.execute(text("DELETE FROM score d USING score k WHERE d.element_id = :d AND k.element_id = :k AND d.user_id = k.user_id AND d.skill = k.skill "
                          "AND LENGTH(d.recent) <= LENGTH(k.recent)"), q)
        conn.execute(text("DELETE FROM score k USING score d WHERE d.element_id = :d AND k.element_id = :k AND d.user_id = k.user_id AND d.skill = k.skill"), q)
        conn.execute(text("UPDATE score SET element_id = :k WHERE element_id = :d"), q)
        conn.execute(text("UPDATE progress_tracking SET element_id = :k WHERE element_id = :d"), q)
        conn.execute(text("UPDATE study_goal_item SET element_id = :k WHERE element_id = :d"), q)
        conn.execute(text("UPDATE change_log SET element_id = :k WHERE element_id = :d"), q)
    conn.execute(text("DELETE FROM vocabulary WHERE id = :d"), p)


def _orphan_word_delete(conn, word_id: str) -> None:
    conn.execute(text("DELETE FROM word w WHERE w.id = :w AND NOT EXISTS (SELECT 1 FROM vocabulary WHERE word_id = w.id) AND NOT EXISTS (SELECT 1 FROM word_passage_link WHERE word_id = w.id) "
                      "AND NOT EXISTS (SELECT 1 FROM character_word_link WHERE word_id = w.id) AND NOT EXISTS (SELECT 1 FROM grammar_example_word WHERE word_id = w.id) "
                      "AND NOT EXISTS (SELECT 1 FROM calligraphy_example_word WHERE word_id = w.id)"), {"w": word_id})


def _tidy_word(conn, keep: str, plain: str) -> None:
    """The kept entry reads without the stray end mark ("Danke." -> "Danke"): point it at the clean word row if one exists (it may carry example links), else rename."""
    cur, lang = conn.execute(text("SELECT w.id, w.language_id FROM vocabulary v JOIN word w ON w.id = v.word_id WHERE v.id = :k"), {"k": keep}).one()
    clean = conn.execute(text("SELECT id FROM word WHERE language_id = :l AND word = :w"), {"l": lang, "w": plain}).scalar()
    if clean and clean != cur:
        conn.execute(text("UPDATE vocabulary SET word_id = :c WHERE id = :k"), {"c": clean, "k": keep})
        _orphan_word_delete(conn, cur)
    elif not clean:
        conn.execute(text("UPDATE word SET word = :w WHERE id = :c"), {"w": plain, "c": cur})


def dedupe(conn, lesson: str, apply: bool = False) -> list[tuple[str, str, str, str]]:
    """[(kept id, kept word, dropped id, dropped word)]; rolls back unless `apply`."""
    rows = conn.execute(text("SELECT v.id, w.word FROM vocabulary v JOIN word w ON w.id = v.word_id WHERE v.lesson_id = :l ORDER BY v.created_at, v.id"), {"l": lesson}).all()
    groups: dict[str, list[tuple[str, str]]] = {}
    for vid, word in rows:
        groups.setdefault(key(word), []).append((vid, word))
    done = []
    for members in (g for g in groups.values() if len(g) > 1):
        ranked = sorted(members, key=lambda m: _evidence(conn, m[0]), reverse=True)
        for drop in ranked[1:]:
            _merge(conn, ranked[0][0], drop[0])
            done.append((ranked[0][0], ranked[0][1], drop[0], drop[1]))
        _tidy_word(conn, ranked[0][0], re.sub(r"[.!?\s]+$", "", ranked[0][1]))
    if not apply:
        conn.rollback()
    return done


if __name__ == "__main__":
    a = argparse.ArgumentParser()
    a.add_argument("--url", required=True); a.add_argument("--schema", default="public"); a.add_argument("--lesson", required=True); a.add_argument("--apply", action="store_true")
    args = a.parse_args()
    with create_engine(args.url, connect_args={"options": f"-c search_path={args.schema}"}).connect() as c:
        for k, kw, d, dw in dedupe(c, args.lesson, args.apply):
            print(f"keep {k} {kw!r} <- {d} {dw!r}")
        if args.apply:
            c.commit()
