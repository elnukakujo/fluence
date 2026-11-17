from typing import Optional

from ..base import BaseComponentDict

class CharacterDict(BaseComponentDict):
    character: str
    phonetic: Optional[str] = None
    meaning: Optional[str] = None
    radical: Optional[str] = None
    strokes: Optional[int] = None
    readings: Optional[list[dict]] = None
    key_radical_id: Optional[str] = None
    components: Optional[list[str]] = None
    clear_radical: Optional[bool] = None            # the form emptied the radical field (a blank string reads as "not given")
    component_glyphs: Optional[list[str]] = None   # what the form types: resolved to `components` ids by the service

    words: Optional[list[dict]] = None  # List of word
    passages: Optional[list[dict]] = None  # List of passage