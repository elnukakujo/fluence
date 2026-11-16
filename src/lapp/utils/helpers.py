from datetime import date, datetime
from math import log2


def _as_date(value: date | datetime) -> date:
    if isinstance(value, datetime):
        return value.date()
    return value


def stack_lists(existing: list | None, incoming: list | None) -> list:
    """Union two lists, preserving order and dropping duplicates.

    Used to combine media (image_files/audio_files) when resolving a
    create() duplicate — media isn't something to pick one version of.
    """
    result = list(existing or [])
    seen = set(result)
    for item in (incoming or []):
        if item not in seen:
            result.append(item)
            seen.add(item)
    return result


def compute_recency_weight(
    created_at: date | datetime,
    last_seen_at: date | datetime
) -> float:
    """
    Computes a recency weight from both created_at and last_seen_at.

    - staleness:  how long since last review  → increases weight (more forgetting)
    - maturity:   how long since item created → decreases weight (well-learned items need less boost)
    """
    today = date.today()

    created_at = _as_date(created_at)
    last_seen_at = _as_date(last_seen_at)

    days_since_seen = (today - last_seen_at).days
    days_since_created = (today - created_at).days

    staleness       = log2(days_since_seen + 2)
    maturity_dampen = log2(days_since_created + 2)

    return staleness / maturity_dampen

def review_priority(
    created_at: date | datetime,
    last_seen_at: date | datetime,
    difficulty: float,
    score: float,
) -> float:
    """Composite "should review now" priority for the daily review queue.

    Sums three independent signals, all derivable from fields already on every
    feature/component (no persisted SRS state):
      - forgetting: recency weight (staleness) scaled by difficulty,
      - difficult:  difficulty itself, so hard cards surface even if recent,
      - learning:   low score, so just-introduced cards repeat into long-term memory.
    """
    forgetting = compute_recency_weight(created_at, last_seen_at) * (1.0 + difficulty)
    learning = 1.0 - min(max(score, 0.0), 100.0) / 100.0
    return forgetting + difficulty + learning


def score_drawing(similarity: float, stroke_order_errors: int) -> float:
    """Combine drawing shape similarity + stroke-order errors into a 0–1 score.

    Shape is primary; each stroke-order error scales it down by 10% (10+ → 0).
    Clamps both inputs so a tampered client can't inflate the score.
    """
    similarity = min(max(similarity, 0.0), 1.0)
    stroke_order_errors = max(int(stroke_order_errors), 0)
    return round(similarity * max(0.0, 1.0 - 0.1 * stroke_order_errors), 4)


def base_element_id(element_id: str) -> str:
    """Strip a vocabulary side suffix (`voc_V1#front` -> `voc_V1`)."""
    return element_id.split("#", 1)[0]
