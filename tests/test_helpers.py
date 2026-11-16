"""Minimal self-check for the pure SRS helpers.

Run: `uv run python tests/test_helpers.py` (no pytest needed).
"""
from datetime import date, timedelta

from lapp.utils.helpers import (
    compute_recency_weight,
    review_priority,
)


def test_recency_weight_boosts_stale_items():
    today = date.today()
    fresh = compute_recency_weight(created_at=today - timedelta(days=10), last_seen_at=today)
    stale = compute_recency_weight(created_at=today - timedelta(days=10), last_seen_at=today - timedelta(days=9))
    assert stale > fresh  # longer since last seen → more forgetting → higher weight


def test_review_priority_ranks_stale_above_fresh():
    today = date.today()
    created_at = today - timedelta(days=30)
    stale = review_priority(created_at=created_at, last_seen_at=today - timedelta(days=10), difficulty=0.5, score=80)
    fresh = review_priority(created_at=created_at, last_seen_at=today, difficulty=0.5, score=80)
    assert stale > fresh  # longer since seen → more forgetting → higher priority


def test_review_priority_boosts_difficult_and_new_cards():
    today = date.today()
    created_at = today - timedelta(days=30)
    mastered = review_priority(created_at=created_at, last_seen_at=today, difficulty=0.1, score=90)
    hard = review_priority(created_at=created_at, last_seen_at=today, difficulty=0.9, score=90)
    new_card = review_priority(created_at=created_at, last_seen_at=today, difficulty=0.1, score=10)
    assert hard > mastered              # hard cards surface even when just seen
    assert new_card > mastered          # low-score (just-introduced) cards repeat


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
