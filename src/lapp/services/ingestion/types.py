"""Shared shapes for the ingestion pipeline (no DB)."""
from typing import Literal

from pydantic import BaseModel

from ..parsing.types import Word

FlagCode = Literal[
    "word_not_in_source", "quote_not_in_source", "translation_generated",
    "low_ocr_confidence", "llm_transcribed_source", "phonetic_mismatch",
    "already_in_language", "already_in_lesson",
    "explanation_not_in_source", "answer_generated", "grammar_generated",
]
Kind = Literal["vocabulary", "grammar", "calligraphy", "exercise"]
ALL_KINDS: list[Kind] = ["vocabulary", "grammar", "calligraphy", "exercise"]


class Chunk(BaseModel):
    id: str
    page: int
    text: str
    trust: Literal["native", "ocr", "llm_transcribed"]
    words: list[Word] = []   # the parser's words, so per-character confidence survives


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
