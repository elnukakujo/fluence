"""Stand-in values for study preferences. Every one is a `TODO(user)`: ask before changing."""

BOOST_FACTOR = 1.5          # TODO(user): review-priority multiplier for boosted exercises
GOAL_MASTERED_SCORE = 60.0  # TODO(user): score at which a goal item counts as mastered
STREAK_MIN_CARDS = 1        # TODO(user): cards answered for a finished review to validate the day

# Without any study goal the daily review still works: new elements are drawn at random from the first N unstarted
# ones of each type (lesson order); seen elements come back by review priority. TODO(user): stand-ins.
NO_GOAL_NEW = {"vocabulary": 10, "grammar": 5, "calligraphy": 10}

# Seconds one review card takes. TODO(user): stand-ins for every number below.
# Exercises are estimated per type: base + reading (question, text support, content) + interaction + listening.
# per_item: seconds per list entry of the content (options, blanks, pairs...); typed: the learner types the answer.
EXERCISE_TIME = {
    "true_false": {"base": 4.0, "per_item": 0.0, "typed": False},
    "select_in_the_blank": {"base": 5.0, "per_item": 1.5, "typed": False},
    "quizz": {"base": 5.0, "per_item": 1.5, "typed": False},
    "matching": {"base": 6.0, "per_item": 2.0, "typed": False},
    "organize": {"base": 6.0, "per_item": 1.5, "typed": False},
    "type_in_the_blank": {"base": 6.0, "per_item": 2.0, "typed": True},
    "translate": {"base": 5.0, "per_item": 0.0, "typed": True},
    "answering": {"base": 6.0, "per_item": 0.0, "typed": True},
    "essay": {"base": 45.0, "per_item": 0.0, "typed": True},
    "speaking": {"base": 15.0, "per_item": 0.0, "typed": False},
    "conversation": {"base": 15.0, "per_item": 5.0, "typed": False},
    "reading": {"base": 15.0, "per_item": 0.0, "typed": False},
    "dictation": {"base": 10.0, "per_item": 0.0, "typed": True},
}
EXERCISE_TIME_DEFAULT = {"base": 10.0, "per_item": 1.0, "typed": False}   # an unknown exercise type
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
GEN_GUARANTEE_READING_FROM = 4   # a batch of at least this many always has a reading (unless banned)

# Leech cards (a card that keeps slipping). TODO(user): stand-ins.
LEECH_LAPSES = 4             # score drops after which a card gets leech help
LEECH_CONFUSABLE_RATIO = 0.6 # spelling similarity (difflib) for a confusable word
LEECH_CANDIDATES = 2000      # words of the language compared at most
