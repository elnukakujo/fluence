"""Stand-in values for study preferences. Every one is a `TODO(user)`: ask before changing."""

BOOST_FACTOR = 1.5          # TODO(user): review-priority multiplier for boosted exercises
GOAL_MASTERED_SCORE = 60.0  # TODO(user): score at which a goal item counts as mastered
STREAK_MIN_CARDS = 1        # TODO(user): cards answered for a finished review to validate the day

# Seconds one review card takes, per section type. TODO(user): stand-ins (exercises vary a lot).
SECONDS_PER_CARD_BY_TYPE = {"voc": 8.0, "call": 15.0, "gram": 90.0, "ex": 60.0}

# Default study goal, scaled by the user's daily minutes. TODO(user): stand-ins anchored on the 20 min/day example
# (20 new vocabulary, 5 grammar, 10 calligraphy a week); the review share is half of the new quantity.
DEFAULT_GOAL_PERIOD = "week"
DEFAULT_GOAL_ANCHOR_MINUTES = 20
DEFAULT_NEW_AT_ANCHOR = {"vocabulary": 20, "grammar": 5, "calligraphy": 10}
DEFAULT_REVIEW_SHARE = 0.5


def default_goal_quantities(daily_minutes: int) -> dict:
    """{"n": {type: new}, "r": {type: review}} for a daily time: linear in the minutes, at least 1 of each."""
    scale = max(daily_minutes, 1) / DEFAULT_GOAL_ANCHOR_MINUTES
    new = {k: max(1, int(v * scale + 0.5)) for k, v in DEFAULT_NEW_AT_ANCHOR.items()}   # half up
    return {"n": new, "r": {k: max(1, int(v * DEFAULT_REVIEW_SHARE + 0.5)) for k, v in new.items()}}
