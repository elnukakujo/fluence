"""Shared shapes for the ingestion pipeline (no DB)."""
from typing import Literal

from pydantic import BaseModel

from ..parsing.types import Word

FlagCode = Literal[
    "word_not_in_source", "quote_not_in_source", "translation_generated",
    "low_ocr_confidence", "llm_transcribed_source", "phonetic_mismatch",
    "already_in_language", "already_in_lesson",
    "explanation_not_in_source", "answer_generated", "grammar_generated", "exercise_unreliable", "listening_inferred", "content_invalid", "explanation_incomplete", "needs_audio",
]
Kind = Literal["vocabulary", "grammar", "calligraphy", "exercise"]
ALL_KINDS: list[Kind] = ["vocabulary", "grammar", "calligraphy", "exercise"]


class Chunk(BaseModel):
    id: str
    page: int
    text: str
    trust: Literal["native", "ocr", "llm_transcribed"]
    words: list[Word] = []   # the parser's words, so per-character confidence survives
    prev: str = ""           # tail of the previous chunk / head of the next, so items cut by a page break can be completed
    next: str = ""

    @property
    def window_text(self) -> str:
        return "\n".join(t for t in (self.prev, self.text, self.next) if t)


class Flag(BaseModel):
    code: FlagCode
    message: str
    # "warning" = the candidate cannot be confirmed / needs a decision; "info" = just a note
    severity: Literal["warning", "info"] = "warning"


class Candidate(BaseModel):
    id: str
    word: str
    translation: str | None = None
    phonetic: str | None = None
    word_type: str | None = None
    quote: str
    page: int
    chunk_id: str
    status: Literal["verified", "flagged"]
    flags: list[Flag] = []
    min_conf: float | None = None
    existing: dict | None = None  # what the app already holds for this item, shown beside it in review


class ElementCandidate(BaseModel):
    """A non-vocabulary element (grammar, calligraphy, exercise) proposed for import."""
    id: str
    kind: Kind
    fields: dict
    quote: str
    page: int
    chunk_id: str
    status: Literal["verified", "flagged"]
    flags: list[Flag] = []
    min_conf: float | None = None
    existing: dict | None = None  # what the app already holds for this item, shown beside it in review
