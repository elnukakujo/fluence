"""Stand-in values for study preferences. Every one is a `TODO(user)`: ask before changing."""
import json
from pathlib import Path

_SHARED = json.loads((Path(__file__).resolve().parents[4] / "shared" / "study-constants.json").read_text(encoding="utf-8"))

BOOST_FACTOR = 1.5          # TODO(user): review-priority multiplier for boosted exercises

# Without any study goal the daily review still works: new elements are drawn at random from the first N unstarted
# ones of each type (lesson order); seen elements come back by review priority. TODO(user): stand-ins.
NO_GOAL_NEW = {"vocabulary": 10, "grammar": 5, "calligraphy": 10}

# Per-type exercise time moved to the exercise registry (services/exercises/registry.py).
# Re-imported here for the time-estimate tests that still read study_constants.
from ..exercises.registry import EXERCISE_TIME, EXERCISE_TIME_DEFAULT

READ_CHARS_PER_S = 15.0     # reading speed for CJK text (characters)
READ_WORDS_PER_S = 3.5      # reading speed for other scripts (words)
TYPE_CHARS_PER_S = 4.0      # typing speed
AUDIO_SECONDS = 4.0         # one audio clip (real durations are not stored)
VOC_SECONDS = 8.0
CALL_SECONDS = 15.0
GRAM_BASE = 20.0
# Measured pace: median of actual / estimated time over the last PACE_SAMPLES cards of a kind, trusted n / (n + PACE_PRIOR_WEIGHT).
PACE_SAMPLES = 20
PACE_PRIOR_WEIGHT = 5
PACE_MIN_MS = 2000          # a card is never counted faster than this ...
PACE_MAX_FACTOR = 5         # ... or slower than this many times its estimate (an idle tab)
SPARE_EXERCISES = 5         # ready exercises sent along as replacements for skipped or broken ones

# Default study goal, from the learner's new per week and reviews per day (the presets set them, the learner can change them).
# TODO(user): stand-ins: the split across the types (20 : 5 : 10, as before) and reading "reviews per day" as the review
# elements of a 7-day period (a longer period scales it).
DEFAULT_GOAL_PERIOD = "week"
DEFAULT_GOAL_SHARE = {k: v for k, v in _SHARED["goalShare"].items() if not k.startswith("_")}   # shared/study-constants.json: the client splits presets the same way


def default_goal_quantities(new_per_week: int, reviews_per_day: int, period_days: int = 7, kinds=tuple(DEFAULT_GOAL_SHARE)) -> dict:
    """{"n": {type: new}, "r": {type: review}} per period, split by DEFAULT_GOAL_SHARE over `kinds` (at least 1 of each unless the total is 0;
    a type outside `kinds` gets 0)."""
    def split(total: float) -> dict:
        whole, parts = round(total), sum(v for k, v in DEFAULT_GOAL_SHARE.items() if k in kinds)
        return {k: (max(1, int(whole * v / parts + 0.5)) if whole and k in kinds else 0) for k, v in DEFAULT_GOAL_SHARE.items()}   # half up
    scale = period_days / 7
    return {"n": split(new_per_week * scale), "r": split(reviews_per_day * scale)}


# AI exercise generation for a lesson. TODO(user): stand-ins for every number below.
GEN_VOC_PER_EXERCISE = 2     # one exercise per this many words
GEN_GRAMMAR_EXERCISES = 2    # exercises per grammar point
GEN_CALL_PER_EXERCISE = 2    # one exercise per this many calligraphy characters
GEN_MIN = 6
GEN_MAX = 60
GEN_THIN_POOL = 6            # a lesson with fewer elements borrows same-level ones from the language's other lessons
GEN_DUPLICATE_RATIO = 0.9    # two generated questions at least this similar count as the same exercise
GEN_READING_WEIGHT = 2.0     # TODO(user): reading is a core exercise, so it is drawn more often than a plain type
GEN_MULTI_ITEM = {"matching": (2, 4), "reading": (3, 5), "conversation": (2, 4)}   # TODO(user): elements per slot (low, high)
GEN_KNOWN_SCORE = 40.0          # TODO(user): score at which a word counts as known when writing exercises
GEN_ADVANCED_FROM = 30          # TODO(user): known words a learner needs before free writing (essay, conversation) is generated
GEN_GUARANTEE_READING_FROM = 4   # a batch of at least this many always has a reading (unless banned)

# Leech cards (a card that keeps slipping). TODO(user): stand-ins.
LEECH_CONFUSABLE_RATIO = 0.6 # spelling similarity (difflib) for a confusable word
LEECH_CANDIDATES = 2000      # words of the language compared at most

# Exercises in the daily review: their share of the time rises with the learner's knowledge. TODO(user): stand-ins.
EXERCISE_MIN_SHARE = 0.1             # share of the review time at knowledge 0
EXERCISE_MAX_SHARE = 0.5             # share at EXERCISE_FULL_KNOWLEDGE_SCORE and above
EXERCISE_FULL_KNOWLEDGE_SCORE = 80.0 # mean element score at which the share is maximal

# Typed target-language answers are graded by character closeness. TODO(user): stand-ins.
PHONETIC_SUB_COST = 0.3     # edit cost of replacing a character by one that sounds the same (a full wrong character costs 1)

# A vocabulary entry that is a whole sentence (a "passage"): no example sentence, no single-word steps. TODO(user): stand-ins.
PASSAGE_MIN_WORDS = 5          # space-separated words
PASSAGE_MIN_CJK_CHARS = 8      # characters of an unspaced script
