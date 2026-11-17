"""Architecture guards: the element id prefix lives in utils/element_kinds.py only.

A ratchet, not a snapshot: KNOWN lists the leftovers the refactor did not reach (each with its owner);
a new offender fails, and a KNOWN entry that no longer offends fails too (delete it).
"""
import re
from pathlib import Path

from lapp.utils.element_kinds import _KINDS

SRC = Path(__file__).resolve().parents[1] / "src" / "lapp"
PREFIX = re.compile(r"""["'](%s)["']""" % "|".join(re.escape(p) for p in _KINDS))

KNOWN = {   # file -> why it still reads a prefix
    "services/system_data/score.py": "voc_ side ids; replaced by the scoring engine in spec 2",
    "services/features/study_goal.py": "_PREFIX_TYPE; spec 3 (goal flags)",
    "services/features/review.py": "voc_/call_ side cards; spec 3 queue split",
    "services/features/review_queue.py": "voc_ side cards, moved out of review.py in the spec 3 split",
    "api/routes/collaboration.py": "lang_/lesson_ share target; spec 4",
}


def _offenders():
    return {
        str(p.relative_to(SRC)) for p in SRC.rglob("*.py")
        if p.name != "element_kinds.py" and PREFIX.search(p.read_text())
    }


def test_no_new_module_hardcodes_an_element_id_prefix():
    assert _offenders() <= set(KNOWN), f"use utils.element_kinds instead: {_offenders() - set(KNOWN)}"


def test_known_leftovers_are_still_leftovers():
    assert set(KNOWN) <= _offenders(), f"fixed, remove from KNOWN: {set(KNOWN) - _offenders()}"
