"""Read-only report before the score-skills migration (d9a3f6b2c8e1): per user, how many elements fall a level
once decay applies (expected, DM-56). Changes nothing.

    python scripts/score_migration_dry_run.py --url postgresql://user:pw@host:5433/db --schema fluence_prod

Refuses to run unless a backup newer than 1 hour exists in backups/ (override: --backup-dir, or --scratch-copy
for a restored copy of a dump, which is never the live database).
"""
import argparse
import sys
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import sqlalchemy as sa

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from lapp.utils.scoring import INITIAL_STABILITY_DAYS, STABILITY_CAP_DAYS, effective_score, level_for  # noqa: E402

ELEMENT_PREFIXES = ("voc_", "gram_", "call_", "char_", "word_", "pass_", "lesson_", "lang_", "ex_")


def fresh_backup(backup_dir: Path, max_age_s: int = 3600) -> bool:
    return any(time.time() - f.stat().st_mtime < max_age_s for f in backup_dir.glob("backup_*.dump"))


def report(conn, now: datetime) -> dict:
    """{user_id: {"elements": n, "falls": n, "by_level": {...}}} from the pre-migration score table."""
    correct = {(u, e): n for u, e, n in conn.execute(sa.text(
        "SELECT user_id, split_part(element_id, '#', 1), count(*) FROM progress_tracking WHERE result GROUP BY 1, 2"))}
    out = defaultdict(lambda: {"elements": 0, "falls": 0, "by_level": defaultdict(int)})
    for r in conn.execute(sa.text("SELECT user_id, element_id, score, last_seen_at FROM score")):
        stab = min(STABILITY_CAP_DAYS, INITIAL_STABILITY_DAYS * 2 ** min(correct.get((r.user_id, r.element_id.split("#")[0]), 0), 10))
        before, after = level_for(r.score), level_for(effective_score(r.score, stab, r.last_seen_at, now))
        u = out[r.user_id]
        u["elements"] += 1
        u["falls"] += before != after
        u["by_level"][f"{before}->{after}"] += before != after
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", required=True)
    ap.add_argument("--schema", required=True)
    ap.add_argument("--backup-dir", default=str(Path(__file__).resolve().parents[1] / "backups"))
    ap.add_argument("--scratch-copy", action="store_true", help="the database is a restored dump, not the live one")
    a = ap.parse_args(argv)
    if not a.scratch_copy and not fresh_backup(Path(a.backup_dir)):
        print(f"Refusing: no backup newer than 1 hour in {a.backup_dir}. Take one first.", file=sys.stderr)
        return 2
    eng = sa.create_engine(a.url, connect_args={"options": f"-csearch_path={a.schema}"})
    with eng.connect() as conn:
        users = report(conn, datetime.now())
    for uid, u in sorted(users.items()):
        moves = ", ".join(f"{k}: {v}" for k, v in sorted(u["by_level"].items()) if v) or "none"
        print(f"{uid}: {u['elements']} score rows, {u['falls']} fall a level after decay ({moves})")
    print(f"total: {sum(u['elements'] for u in users.values())} rows, {sum(u['falls'] for u in users.values())} fall a level")
    return 0


if __name__ == "__main__":
    sys.exit(main())
