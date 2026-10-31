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
        flag("translation_not_in_source", "The translation is not in the source text (written by the model, check it)")

    min_conf = _min_confidence(item.word, chunk)
    if chunk.trust == "ocr" and min_conf is not None and min_conf < LOW_WORD_CONF:
        flag("low_ocr_confidence", f"The OCR was unsure about this word (confidence {min_conf:.2f})")
    if chunk.trust == "llm_transcribed":
        flag("llm_transcribed_source", "This page was transcribed by a vision model, not measured by OCR")

    if iso1 in _PHONETIC_LANGS and item.phonetic:
        try:
            expected = get_phonetic(item.word, iso1)
        except Exception:  # a missing optional library must not fail extraction
            logger.exception("Phonetic check failed for %r", item.word)
            expected = ""
        if expected and _strip_marks(expected) != _strip_marks(item.phonetic):
            flag("phonetic_mismatch", f'The model gave "{item.phonetic}", expected "{expected}"')

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
