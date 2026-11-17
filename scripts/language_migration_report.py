"""List the courses the language-registry migration could not give a supported language (iso1), so the owner can decide
each one (TODO(owner)). Nothing is deleted or merged. Run after `alembic upgrade head`:

    python scripts/language_migration_report.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))


def report(session) -> dict[str, list[dict]]:
    """{"unmatched": courses with no supported language, "duplicates": second courses of a language one user already has}."""
    from lapp.core.languages import match_course
    from lapp.models.containers import Language
    out: dict[str, list[dict]] = {"unmatched": [], "duplicates": []}
    for lang in session.query(Language).filter(Language.iso1.is_(None)).order_by(Language.user_id, Language.position):
        row = {"id": lang.id, "user_id": lang.user_id, "name": lang.name, "alias": lang.alias, "target_iso639_2t": lang.target_iso639_2t}
        hit = match_course(lang.name, lang.alias, lang.target_iso639_2t)
        out["duplicates" if hit else "unmatched"].append({**row, "would_be": hit.iso1 if hit else None})
    return out


if __name__ == "__main__":
    from lapp.core.database import db_manager
    with db_manager.session_scope() as s:
        result = report(s)
    for kind, rows in result.items():
        print(f"\n{kind}: {len(rows)}")
        for r in rows:
            print("  ", r)
