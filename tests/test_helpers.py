"""Minimal self-check for the pure SRS helpers.

Run: `uv run python tests/test_helpers.py` (no pytest needed).
"""
from datetime import datetime, timedelta

from lapp.utils.helpers import review_priority

NOW = datetime(2026, 11, 16, 12, 0)


def prio(score=50, stability=2.0, days_ago=1, lapses=0):
    return review_priority(score, stability, NOW - timedelta(days=days_ago) if days_ago is not None else None, lapses, NOW)


def test_lower_score_ranks_higher():
    assert prio(score=10) > prio(score=50) > prio(score=90)


def test_longer_unseen_ranks_higher_relative_to_stability():
    assert prio(days_ago=10) > prio(days_ago=1)
    assert prio(stability=1.0, days_ago=4) > prio(stability=8.0, days_ago=4)   # same gap, less stable = more overdue


def test_more_lapses_rank_higher():
    assert prio(lapses=3) > prio(lapses=1) > prio(lapses=0)


def test_never_seen_has_nothing_overdue():
    assert prio(score=0, days_ago=None) == 1.0 and prio(score=0, days_ago=None) < prio(score=0, days_ago=30)


def test_base_element_id():
    from lapp.utils.helpers import base_element_id
    assert base_element_id("voc_V1#back") == "voc_V1"
    assert base_element_id("voc_V1#front") == "voc_V1"
    assert base_element_id("voc_V1") == "voc_V1"


def test_generate_new_id_skips_taken_ids_and_insert_never_overwrites(app, db):
    from lapp.models import User
    from sqlalchemy import update
    from lapp.core.database import id_counter_table
    mk = lambda i, n: User(id=i, username=n, display_name=n, email=f"{n}@x.io", password_hash="x")
    db.insert(mk("user_U1", "a"))
    db.generate_new_id(User)                          # seeds the counter
    with db.get_session() as s:                       # make it stale: points at the taken id
        s.execute(update(id_counter_table).where(id_counter_table.c.entity_type == "User").values(next_value=1))
        s.commit()
    assert db.generate_new_id(User) != "user_U1"
    assert db.insert(mk("user_U1", "b")) is None      # collision: refused, not merged
    with db.get_session() as s:
        assert s.get(User, "user_U1").username == "a"
