"""How many exercises the daily review holds: the share rises with the learner's knowledge; exercises on barely-seen elements are held back."""
from .study_constants import (EXERCISE_FULL_KNOWLEDGE_SCORE, EXERCISE_MAX_SHARE, EXERCISE_MIN_LINKED_AVG, EXERCISE_MIN_SHARE)


def knowledge(scores: list[float]) -> float:
    return sum(scores) / len(scores) if scores else 0.0


def exercise_share(know: float) -> float:
    return EXERCISE_MIN_SHARE + (EXERCISE_MAX_SHARE - EXERCISE_MIN_SHARE) * min(max(know / EXERCISE_FULL_KNOWLEDGE_SCORE, 0.0), 1.0)


def is_eligible(linked_scores: list[float]) -> bool:
    return bool(linked_scores) and knowledge(linked_scores) >= EXERCISE_MIN_LINKED_AVG


def exercise_quota(share: float, cap_seconds: float, mean_exercise_seconds: float, available: int) -> int:
    return min(available, round(share * cap_seconds / mean_exercise_seconds))
