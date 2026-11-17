from typing import Optional

from ..base import BaseContainerDict

class LanguageDict(BaseContainerDict):
    name: Optional[str] = None  # filled from the supported language on create
    alias: Optional[str] = None
    iso1: Optional[str] = None  # one of the supported languages; fills name, flag and target_iso639_2t
    flag: Optional[str] = None  # Flag emoji

    target_iso639_2t: Optional[str] = None
    source_iso639_2t: Optional[str] = None
    
    user_id: Optional[str] = None
    current_lesson_id: Optional[str] = None