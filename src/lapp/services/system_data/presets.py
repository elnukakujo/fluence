"""Learning-intensity presets (DM-66): pace only, skills are never part of a preset."""

PRESETS: dict[str, dict[str, int]] = {
    "casual": {"new_per_week": 5, "reviews_per_day": 20, "streak_min_answers": 10},
    "standard": {"new_per_week": 15, "reviews_per_day": 40, "streak_min_answers": 20},
    "intensive": {"new_per_week": 30, "reviews_per_day": 80, "streak_min_answers": 40},
}
