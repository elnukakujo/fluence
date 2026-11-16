"""Spec 3 guards: the learner's clock is the only source of "today", and the streak minimum is an answer count, not a card count."""
import re
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "src" / "lapp"
SERVER_TODAY = re.compile(r"\bdate\.today\(\)|datetime\.now\(\)\.date\(\)|datetime\.today\(\)\.date\(\)")


def _offenders(pattern):
    return sorted(str(p.relative_to(SRC)) for p in SRC.rglob("*.py") if p.name != "learner_clock.py" and pattern.search(p.read_text()))


def test_no_server_clock_day_outside_learner_clock():
    assert _offenders(SERVER_TODAY) == []


def test_streak_min_cards_is_gone():
    assert _offenders(re.compile(r"STREAK_MIN_CARDS")) == []
