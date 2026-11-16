from datetime import date, datetime
from math import log2


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


def review_priority(
    effective_score: float,
    stability: float,
    last_seen_at: datetime | None,
    lapses: int,
    now: datetime,
) -> float:
    """"Should review now" priority, higher = sooner. Monotone in each input (spec 3 G2):
      - a lower effective score (decay already applied) ranks higher,
      - a longer time since last seen, relative to the stability (days to halve), ranks higher,
      - more lapses (wrong answers among the recent ones) rank higher.
    A never-seen element has nothing overdue: it ranks by its (zero) score alone.
    TODO(owner): the weights are stand-ins; the spec only asks for a monotone combination."""
    low = 1.0 - min(max(effective_score, 0.0), 100.0) / 100.0
    overdue = 0.0 if last_seen_at is None else max(0.0, (now - last_seen_at).total_seconds() / 86400) / max(stability, 0.1)
    return low + log2(1.0 + overdue) + 0.25 * max(lapses, 0)


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
