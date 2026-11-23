"""One-off prod repair (spec 2026-11-22, SC-33). Dry-run by default; run on a prod copy first and read the report.

1. Delete the dead rows the score migration left: vocabulary parent rows (parents are computed on read, RD-48) and the unused skill of each
   vocabulary side (#front keeps recognition, #back keeps recall) that was never answered.
2. Lift the real rows of the chosen lessons (the intro lesson and units 1-15 of the Chinese course: positions 0..15) to Known: score >= 65,
   stability >= 20 days, last seen now. Only existing rows, only ever upwards; nothing is created, so unseen cards stay unseen.
Idempotent: a second run finds nothing to change. Touches only `--user`.

    python scripts/repair_scores_2026_11_22.py --url postgresql+psycopg://u:p@host/db --schema fluence_prod --user user_U0 --language lang_L1 [--apply]
"""
import argparse

from sqlalchemy import create_engine, text

SCORE, STABILITY, FIRST, LAST = 65.0, 20.0, 0, 15

DEAD_PARENTS = "DELETE FROM score WHERE user_id = :u AND element_id LIKE 'voc\\_%' AND element_id NOT LIKE '%#%'"
DEAD_SIDE_SKILL = ("DELETE FROM score WHERE user_id = :u AND recent = '' AND "
                   "((element_id LIKE '%#front' AND skill <> 'recognition') OR (element_id LIKE '%#back' AND skill <> 'recall'))")
# the rows each card kind really owns: vocabulary sides, grammar reading card, calligraphy
LIFT = """
UPDATE score SET score = GREATEST(score, :score), stability = GREATEST(stability, :stab), difficulty = 1 - GREATEST(stability, :stab) / 180.0, last_seen_at = now()
WHERE user_id = :u AND (score < :score OR stability < :stab) AND (
    (element_id IN (SELECT v.id || '#front' FROM vocabulary v JOIN lesson l ON l.id = v.lesson_id WHERE l.language_id = :lang AND l.position BETWEEN :a AND :b) AND skill = 'recognition')
 OR (element_id IN (SELECT v.id || '#back' FROM vocabulary v JOIN lesson l ON l.id = v.lesson_id WHERE l.language_id = :lang AND l.position BETWEEN :a AND :b) AND skill = 'recall')
 OR (element_id IN (SELECT g.id FROM grammar g JOIN lesson l ON l.id = g.lesson_id WHERE l.language_id = :lang AND l.position BETWEEN :a AND :b) AND skill = 'recognition')
 OR (element_id IN (SELECT c.id FROM calligraphy c JOIN lesson l ON l.id = c.lesson_id WHERE l.language_id = :lang AND l.position BETWEEN :a AND :b) AND skill = 'recall'))
"""


def repair(conn, user: str, language: str, apply: bool = False) -> dict[str, int]:
    """Counts per step; rolls back unless `apply`."""
    p = {"u": user, "lang": language, "score": SCORE, "stab": STABILITY, "a": FIRST, "b": LAST}
    out = {"dead_parents": conn.execute(text(DEAD_PARENTS), p).rowcount,
           "dead_side_skills": conn.execute(text(DEAD_SIDE_SKILL), p).rowcount,
           "lifted": conn.execute(text(LIFT), p).rowcount}
    if not apply:
        conn.rollback()
    return out


if __name__ == "__main__":
    a = argparse.ArgumentParser()
    a.add_argument("--url", required=True); a.add_argument("--schema", default="public"); a.add_argument("--user", required=True)
    a.add_argument("--language", required=True); a.add_argument("--apply", action="store_true")
    args = a.parse_args()
    with create_engine(args.url, connect_args={"options": f"-c search_path={args.schema}"}).connect() as c:
        print(("APPLIED" if args.apply else "DRY RUN"), repair(c, args.user, args.language, args.apply))
        if args.apply:
            c.commit()
