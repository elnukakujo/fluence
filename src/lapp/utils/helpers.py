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


def update_score(
    score: float,
    last_seen_at: date | datetime,
    similarity: float,        # 0.0 to 1.0
    created_at: date | datetime = date.today(),
    difficulty: float = 0.5,  # 0.0 (easy) to 1.0 (hard)
    scale: float = 5.0
) -> float:
    """
    Updates the score for any Feature or Component after a review session.

    Args:
        score:        Current score (0–100)
        created_at:   Date the item was first created/added
        last_seen_at: Date the item was last reviewed
        similarity:   Answer quality (0.0 = wrong, 1.0 = perfect)
        difficulty:   Current difficulty ratio (0.0 = easy, 1.0 = hard)
        scale:        Score given for a perfect answer on day one
    """
    created_at = _as_date(created_at)
    last_seen_at = _as_date(last_seen_at)

    remaining_days = (date.today() - last_seen_at).days
    recency_weight = compute_recency_weight(created_at, last_seen_at)

    # Slower decay for hard items, faster for easy ones, modulated by recency
    time_weight = log2(remaining_days + 2) * scale * (1 + difficulty) * recency_weight

    # Partial success gives partial benefit; mistakes apply a half-weight penalty
    score += similarity * time_weight - (1 - similarity) * time_weight * 0.5

    return round(min(max(0.0, score), 100.0), 4)


def update_difficulty(
    new_score: float,
    last_seen_at: date | datetime,
    previous_difficulty: float,  # Initialize as 0.5 if no prior value
    created_at: date | datetime = date.today(),
    scale: float = 1.0,
    alpha: float = 0.3           # EMA learning rate: higher = more reactive
) -> float:
    """
    Updates the difficulty ratio for any Feature or Component based on score performance.

    Args:
        new_score:           Score after calling update_score() (0–100)
        created_at:          Date the item was first created/added
        last_seen_at:        Date the item was last reviewed
        previous_difficulty: Prior difficulty (0.0 = easy, 1.0 = hard)
        scale:               Sensitivity of difficulty shift
        alpha:               EMA learning rate (0.0 = ignore new signal, 1.0 = fully reactive)
    """
    created_at = _as_date(created_at)
    last_seen_at = _as_date(last_seen_at)
    recency_weight = compute_recency_weight(created_at, last_seen_at)

    # Normalize score to 0–1 performance signal
    performance = new_score / 100.0

    # Poor performance → push difficulty UP; strong performance → pull it DOWN
    # Centered at 0.5 performance as the neutral point
    difficulty_delta = (0.5 - performance) * scale * recency_weight * 0.1

    # Exponential moving average for stability across sessions
    new_difficulty = (1 - alpha) * previous_difficulty + alpha * (previous_difficulty + difficulty_delta)

    return min(max(0.0, new_difficulty), 1.0)


def score_drawing(similarity: float, stroke_order_errors: int) -> float:
    """Combine drawing shape similarity + stroke-order errors into a 0–1 score.

    Shape is primary; each stroke-order error scales it down by 10% (10+ → 0).
    """
    return round(similarity * max(0.0, 1.0 - 0.1 * stroke_order_errors), 4)