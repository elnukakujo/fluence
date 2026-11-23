"""RC-27 one-off: recompute daily_stats items/correct/time counting one row per card (rows an exercise writes for its linked elements are
not counted). Dry-run by default: prints before -> after per day; writes only with --apply. Touches only `--user`.

    python scripts/recount_daily_stats_2026_11_23.py --url postgresql+psycopg://u:p@host/db --schema fluence_prod --user user_U0 [--apply]
"""
import argparse

from sqlalchemy import create_engine, text

# ponytail: days are matched on date(created_at) like the app's own range queries; a learner timezone offset can move a late-night row by one day.
SQL = """
UPDATE daily_stats d SET items_reviewed = n.items, items_correct = n.correct, time_studied_ms = n.ms
FROM (SELECT d2.id, COUNT(p.id) AS items, COUNT(p.id) FILTER (WHERE p.result IS TRUE) AS correct, COALESCE(SUM(p.duration_ms), 0) AS ms
      FROM daily_stats d2 LEFT JOIN progress_tracking p ON p.user_id = d2.user_id AND p.language_id = d2.language_id
           AND date(p.created_at) = date(d2.created_at) AND (p.card_id IS NULL OR p.card_id = p.element_id)
      WHERE d2.user_id = :u AND (SELECT COUNT(*) FROM daily_stats o WHERE o.user_id = d2.user_id AND o.language_id = d2.language_id
            AND date(o.created_at) = date(d2.created_at)) = 1      -- days with duplicate rows are left alone: no way to tell which row owns which answers
      GROUP BY d2.id) n
WHERE d.id = n.id AND (d.items_reviewed, d.items_correct, d.time_studied_ms) IS DISTINCT FROM (n.items, n.correct, n.ms)
RETURNING d.id, d.items_reviewed, d.items_correct, d.time_studied_ms
"""
BEFORE = "SELECT id, items_reviewed, items_correct, time_studied_ms FROM daily_stats WHERE user_id = :u"


def recount(conn, user: str, apply: bool = False) -> list[tuple]:
    """[(id, before, after)] for the days that change; rolls back unless `apply`."""
    before = {r[0]: tuple(r[1:]) for r in conn.execute(text(BEFORE), {"u": user})}
    changed = [(r[0], before[r[0]], tuple(r[1:])) for r in conn.execute(text(SQL), {"u": user})]
    if not apply:
        conn.rollback()
    return changed


if __name__ == "__main__":
    a = argparse.ArgumentParser()
    a.add_argument("--url", required=True); a.add_argument("--schema", default="public"); a.add_argument("--user", required=True)
    a.add_argument("--apply", action="store_true")
    args = a.parse_args()
    with create_engine(args.url, connect_args={"options": f"-c search_path={args.schema}"}).connect() as c:
        for i, b, n in recount(c, args.user, args.apply):
            print(i, "items/correct/ms", b, "->", n)
        if args.apply:
            c.commit()
        print("APPLIED" if args.apply else "DRY RUN")
