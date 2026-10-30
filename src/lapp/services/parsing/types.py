"""Uniform parser output. Trust invariants are enforced here so no route can mislabel a page."""
from typing import Literal

from pydantic import BaseModel, Field, model_validator

BBox = tuple[float, float, float, float]  # x0, y0, x1, y1 in page units

ParseErrorCode = Literal[
    "encrypted", "corrupt", "unsupported", "too_large", "too_many_pages", "ocr_language_unsupported", "remote_unsupported", "invalid_range", "ocr_incomplete",
]

_TRUST_BY_SOURCE = {"native": "native", "ocr_local": "ocr", "ocr_remote": "llm_transcribed"}


class ParseError(Exception):
    """Typed, user-presentable failure; `code` is stable for callers to map."""

    def __init__(self, code: ParseErrorCode, message: str):
        self.code = code
        super().__init__(message)


class Word(BaseModel):
    text: str
    bbox: BBox
    conf: float | None = Field(default=None, ge=0, le=1)


class Block(BaseModel):
    text: str
    bbox: BBox
    kind: Literal["heading", "body", "list_like"] = "body"
    font_size: float | None = None
    words: list[Word] = []


class Page(BaseModel):
    index: int
    width: float
    height: float
    source: Literal["native", "ocr_local", "ocr_remote"]
    trust: Literal["native", "ocr", "llm_transcribed"]
    blocks: list[Block] = []
    mean_confidence: float | None = None
    warnings: list[str] = []

    @model_validator(mode="after")
    def _check_trust(self) -> "Page":
        if _TRUST_BY_SOURCE[self.source] != self.trust:
            raise ValueError(f"source {self.source!r} cannot have trust {self.trust!r}")
        confs = [w.conf for b in self.blocks for w in b.words]
        if self.trust == "ocr":
            if any(c is None for c in confs):
                raise ValueError("local OCR words must carry a confidence")
        elif self.mean_confidence is not None or any(c is not None for c in confs):
            raise ValueError(f"{self.trust!r} pages must not carry confidence scores")
        return self


class Document(BaseModel):
    sha256: str
    pipeline_version: str
    pages: list[Page]
    warnings: list[str] = []
