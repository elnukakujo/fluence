import pytest

from lapp.services.features.exercise_share import exercise_quota, exercise_share, is_eligible, knowledge
from lapp.services.features.study_constants import (EXERCISE_FULL_KNOWLEDGE_SCORE, EXERCISE_MAX_SHARE, EXERCISE_MIN_SHARE)


def test_share_bounds():
    assert exercise_share(0) == pytest.approx(EXERCISE_MIN_SHARE)
    assert exercise_share(EXERCISE_FULL_KNOWLEDGE_SCORE) == pytest.approx(EXERCISE_MAX_SHARE)


def test_share_monotonic_and_clamped():
    assert exercise_share(20) < exercise_share(40) < exercise_share(60)
    assert exercise_share(1000) == pytest.approx(EXERCISE_MAX_SHARE)


def test_knowledge_empty_is_zero():
    assert knowledge([]) == 0.0


def test_exercise_linked_to_nothing_is_eligible():
    assert is_eligible([])


def test_eligible_once_every_linked_element_was_seen():
    assert is_eligible([True, True])
    assert not is_eligible([True, False])


def test_quota_capped_and_zero():
    assert exercise_quota(0.5, 1200, 10, 5) == 5
    assert exercise_quota(0.0, 1200, 10, 5) == 0
