"""Deterministic checks of an extracted item against the text it claims to come from (no LLM)."""
import logging
import re
import unicodedata
import uuid
from typing import Callable, Literal

from ...utils.phonetics import get_phonetic
from ..parsing.pipeline import LOW_WORD_CONF
from .extract import RawItem
from .types import Candidate, Chunk, Flag

logger = logging.getLogger(__name__)

_PHONETIC_LANGS = {"zh", "ja", "ko"}


def normalise(s: str) -> str:
    """NFKC + casefold + all whitespace removed (CJK has none; for Latin this slightly loosens matching)."""
    return "".join(unicodedata.normalize("NFKC", s).casefold().split())


def normalise_keep_spaces(s: str) -> str:
    return unicodedata.normalize("NFKC", s).casefold()


def _strip_marks(s: str) -> str:
    decomposed = unicodedata.normalize("NFD", normalise(s))
    return "".join(c for c in decomposed if not unicodedata.combining(c) and c not in "'-’")


def _min_confidence(word: str, chunk: Chunk) -> float | None:
    """Lowest OCR confidence over the characters the word covers, or None (native/remote or not located)."""
    chars: list[str] = []
    confs: list[float | None] = []
    for w in chunk.words:
        n = normalise(w.text)
        chars.append(n)
        confs.extend([w.conf] * len(n))
    stream, target = "".join(chars), normalise(word)
    i = stream.find(target) if target else -1
    covered = [c for c in confs[i:i + len(target)] if c is not None] if i != -1 else []
    return min(covered) if covered else None


def _words_present(translation: str, chunk_text: str) -> bool:
    """Every word of the translation occurs in the chunk: a wrapped line in a multi-column layout splits a translation."""
    words = lambda t: {w for w in re.split(r"[\s,;.]+", normalise_keep_spaces(t)) if w}
    return words(translation) <= words(chunk_text)


def _phonetic_flag(word: str, phonetic: str | None, iso1: str | None) -> Flag | None:
    if iso1 not in _PHONETIC_LANGS or not phonetic:
        return None
    try:
        expected = get_phonetic(word, iso1)
    except Exception:  # a missing optional library must not fail extraction
        logger.exception("Phonetic check failed for %r", word)
        expected = ""
    if expected and _strip_marks(expected) != _strip_marks(phonetic):
        return Flag(code="phonetic_mismatch", message=f'The model gave "{phonetic}", expected "{expected}"')
    return None


def _source_flags(key: str, chunk: Chunk) -> tuple[list[Flag], float | None]:
    """OCR-confidence and vision-transcription flags for `key`, plus its minimum OCR confidence."""
    flags: list[Flag] = []
    min_conf = _min_confidence(key, chunk)
    if chunk.trust == "ocr" and min_conf is not None and min_conf < LOW_WORD_CONF:
        flags.append(Flag(code="low_ocr_confidence", message=f"The OCR was unsure about this word (confidence {min_conf:.2f})"))
    if chunk.trust == "llm_transcribed":
        flags.append(Flag(code="llm_transcribed_source", message="This page was transcribed by a vision model, not measured by OCR"))
    return flags, min_conf


def verify(item: RawItem, chunk: Chunk, iso1: str | None,
           lookup: Callable[[str], Literal["lesson", "language"] | None]) -> Candidate:
    text = normalise(chunk.text)
    flags: list[Flag] = []

    def flag(code, message, severity="warning"):
        flags.append(Flag(code=code, message=message, severity=severity))

    if normalise(item.word) not in text:
        flag("word_not_in_source", f'"{item.word}" does not appear in the source text')
    if normalise(item.quote) not in text:
        flag("quote_not_in_source", "The quoted passage does not appear in the source text")
    if item.translation and normalise(item.translation) not in text and not _words_present(item.translation, chunk.text):
        flag("translation_generated", "The translation was written by the model, not found in the document - check it")

    source_flags, min_conf = _source_flags(item.word, chunk)
    flags += source_flags
    if (pf := _phonetic_flag(item.word, item.phonetic, iso1)):
        flags.append(pf)

    # existing words are reused, not suspicious: only a duplicate inside the target lesson needs a decision
    where = lookup(item.word)
    if where == "lesson":
        flag("already_in_lesson", "This word is already in this lesson")
    elif where == "language":
        flag("already_in_language", "Already in your language - the existing word will be reused", "info")

    return Candidate(
        id=uuid.uuid4().hex, word=item.word, translation=item.translation, phonetic=item.phonetic,
        word_type=item.word_type, quote=item.quote, page=chunk.page, chunk_id=chunk.id,
        status="flagged" if any(f.severity == "warning" for f in flags) else "verified", flags=flags, min_conf=min_conf,
    )
