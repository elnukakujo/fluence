from typing import Optional
from pydantic import model_validator

from ..base import BaseComponentDict

WORD_TYPES = ("noun", "verb", "adjective", "adverb", "pronoun", "article", "preposition", "conjunction", "particle", "interjection", "numeral", "classifier", "auxiliary", "modal", "")  # "" = not given


class WordDict(BaseComponentDict):
    word: str
    translation: Optional[str] = None
    phonetic: Optional[str] = None
    word_type: Optional[str] = None
    word_gender: Optional[str] = None

    characters: Optional[list[dict]] = None  # List of character
    passages: Optional[list[dict]] = None  # List of passage

    @model_validator(mode="after")
    def _validate(self):
        valid_types = list(WORD_TYPES)
        if self.word_type is not None and self.word_type.lower() not in valid_types:
            raise ValueError(f"Invalid type: {self.word_type}. Must be one of {valid_types}.")
        valid_gender = ["m", "f", "n", "c", ""]
        if self.word_gender is not None and self.word_gender.lower() not in valid_gender:
            raise ValueError(f"Invalid gender: {self.word_gender}. Must be one of {valid_gender}.")
        return self