from typing import Optional
from pydantic import model_validator

from ..base import BaseFeatureDict

VALID_EXERCISE_TYPES = [
    "essay",
    "answering",
    "translate",
    "organize",
    "type_in_the_blank",
    "select_in_the_blank",
    "matching",
    "true_false",
    "speaking",
    "conversation",
    "quizz",
    "reading",
    "dictation",
]


class ExerciseDict(BaseFeatureDict):
    exercise_type: Optional[str] = None         # e.g., "type_in_the_blank", "multiple_choice"
    question: str
    answer: str
    text_support: Optional[str] = None          # e.g., additional text information
    content: Optional[dict] = None              # structured data for the structured types below

    related_vocabulary: Optional[list[str]] = None # e.g., ["voc_V1"]
    related_calligraphy: Optional[list[str]] = None  # e.g., ["call_C1"]
    related_grammar: Optional[list[str]] = None    # e.g., ["gram_G1"]

    @model_validator(mode='after')
    def _validate(self):
        valid_exercise_types = VALID_EXERCISE_TYPES
        if self.exercise_type not in valid_exercise_types:
            raise ValueError(f"Invalid exercise_type: {self.exercise_type}. Must be one of {valid_exercise_types}.")

        structured_required_keys = {
            "type_in_the_blank": {"segments", "blanks"},
            "select_in_the_blank": {"segments", "blanks"},
            "matching": {"pairs"},
            "organize": {"items", "answer_order"},
            "true_false": {"statement", "answer"},
            "quizz": {"options", "correct"},
            "reading": {"speakers", "lines"},
            "dictation": {"lines"},
        }
        required_keys = structured_required_keys.get(self.exercise_type)
        if required_keys:
            if not isinstance(self.content, dict):
                raise ValueError(f"exercise_type '{self.exercise_type}' requires a 'content' object with keys {required_keys}.")
            missing = required_keys - self.content.keys()
            if missing:
                raise ValueError(f"content for exercise_type '{self.exercise_type}' is missing keys: {missing}.")
        return self