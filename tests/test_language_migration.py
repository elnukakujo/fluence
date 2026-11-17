"""Course migration: nothing deleted, everything unmatched or duplicated is reported (Review Focus 2)."""
import sys
from pathlib import Path

from lapp.core.languages import assign_iso1
from lapp.models.containers import Language
from lapp.models.system_data import User

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from language_migration_report import report  # noqa: E402


def test_assignment_matches_by_iso_then_name_and_skips_duplicates_and_unknowns():
    rows = [
        ("a", "u1", "Mon français", None, "fra"),        # by ISO 639-2/T
        ("b", "u1", "French", None, None),               # same user, same language: duplicate, not merged
        ("c", "u1", "日本語", None, None),                 # non-English script, no ISO: unmatched
        ("d", "u1", "Spanish", None, None),              # by name
        ("e", "u1", "My course", "Korean", None),        # by alias
        ("f", "u2", "French", None, "fra"),              # another user may have fr too
        ("g", "u2", "Klingon", None, "tlh"),             # unsupported ISO: unmatched
    ]
    assert assign_iso1(rows) == {"a": "fr", "d": "es", "e": "ko", "f": "fr"}


def test_report_lists_unmatched_and_duplicates_and_deletes_nothing(db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="u", email="u@x.com"), session=s, commit=False)
        for id_, name, iso2, iso1 in [("l1", "French", "fra", "fr"), ("l2", "French 2", "fra", None),
                                      ("l3", "日本語", None, None), ("l4", "Custom", None, None)]:
            db.insert(Language(id=id_, user_id="user_U1", name=name, target_iso639_2t=iso2, iso1=iso1), session=s, commit=False)
    with db.session_scope() as s:
        out = report(s)
        assert [r["id"] for r in out["duplicates"]] == ["l2"]
        assert {r["id"] for r in out["unmatched"]} == {"l3", "l4"}
        assert s.query(Language).count() == 4
