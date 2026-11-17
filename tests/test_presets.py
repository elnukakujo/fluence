"""The three presets (the client only fills the form with them; nothing is saved until Save)."""
from lapp.services.system_data.presets import PRESETS


def test_values_are_exactly_the_listed_ones():
    assert PRESETS == {"casual": {"new_per_week": 5, "reviews_per_day": 20, "streak_min_answers": 10},
                       "standard": {"new_per_week": 15, "reviews_per_day": 40, "streak_min_answers": 20},
                       "intensive": {"new_per_week": 30, "reviews_per_day": 80, "streak_min_answers": 40}}
