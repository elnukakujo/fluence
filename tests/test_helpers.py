"""Minimal self-check for the pure SRS helpers.

Run: `uv run python tests/test_helpers.py` (no pytest needed).
"""
from datetime import date, timedelta

from lapp.utils.helpers import (
    compute_recency_weight,
    review_priority,
    update_difficulty,
    update_score,
    status_for,
)


def test_recency_weight_boosts_stale_items():
    today = date.today()
    fresh = compute_recency_weight(created_at=today - timedelta(days=10), last_seen_at=today)
    stale = compute_recency_weight(created_at=today - timedelta(days=10), last_seen_at=today - timedelta(days=9))
    assert stale > fresh  # longer since last seen → more forgetting → higher weight


def test_update_score_stays_in_bounds():
    today = date.today()
    perfect = update_score(score=50, last_seen_at=today - timedelta(days=3), similarity=1.0,
                           created_at=today - timedelta(days=3))
    wrong = update_score(score=50, last_seen_at=today - timedelta(days=3), similarity=0.0,
                         created_at=today - timedelta(days=3))
    assert 0.0 <= wrong <= perfect <= 100.0
    assert perfect > 50  # a correct review raises the score
    assert wrong < 50    # a wrong review lowers it


def test_update_difficulty_reacts_to_performance():
    today = date.today()
    kwargs = dict(last_seen_at=today - timedelta(days=2), previous_difficulty=0.5,
                  created_at=today - timedelta(days=2))
    easy = update_difficulty(new_score=95, **kwargs)
    hard = update_difficulty(new_score=10, **kwargs)
    assert hard > easy               # poor performance pushes difficulty up
    assert 0.0 <= easy <= 1.0 and 0.0 <= hard <= 1.0


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


def test_status_for_all_sets():
    # Language (fluent scale)
    assert status_for("lang_L1", 0)   == "unstarted"
    assert status_for("lang_L1", 30)  == "beginner"
    assert status_for("lang_L1", 60)  == "intermediary"
    assert status_for("lang_L1", 90)  == "advanced"
    assert status_for("lang_L1", 91)  == "fluent"
    # Lesson + features (progress scale)
    assert status_for("lesson_L1", 0)   == "unstarted"
    assert status_for("lesson_L1", 74)  == "inprogress"
    assert status_for("lesson_L1", 99)  == "revisiting"
    assert status_for("lesson_L1", 100) == "completed"
    assert status_for("voc_V1", 74) == "inprogress"
    assert status_for("voc_V1", 75) == "revisiting"  # boundary: <75, not <=75
    assert status_for("gram_G1", 100) == "completed"
    assert status_for("call_C1", 0) == "unstarted"
    assert status_for("ex_E1", 99) == "revisiting"
    # Components (mastery scale)
    assert status_for("word_W1", 0)   == "unseen"
    assert status_for("word_W1", 10)  == "introduced"
    assert status_for("word_W1", 50)  == "learning"
    assert status_for("word_W1", 75)  == "practicing"
    assert status_for("word_W1", 90)  == "review"
    assert status_for("word_W1", 91)  == "mastered"
    assert status_for("char_C1", 50) == "learning"
    assert status_for("pass_P1", 91) == "mastered"


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"ok  {name}")
    print("all helper checks passed")
