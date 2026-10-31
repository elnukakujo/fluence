"""chunk -> extract -> verify for one parsed Document. DB-free: the caller supplies `exists`."""
import logging
from dataclasses import dataclass, field
from typing import Callable, Literal

from ...utils.detect_language import get_language_by_iso2t
from ...utils.model_api import ModelAPIError
from ..parsing.types import Document
from .chunk import chunk_document
from .extract import ExtractionError, extract_chunk
from .types import Candidate
from .verify import normalise, verify

logger = logging.getLogger(__name__)

# Misconfiguration repeats on every chunk; fail the job once instead of once per chunk.
_ABORT_KINDS = {ModelAPIError.KIND_AUTH, ModelAPIError.KIND_NOT_FOUND}


@dataclass
class BuildResult:
    candidates: list[Candidate] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def build_candidates(
    doc: Document,
    api: dict,
    target_iso639_2t: str | None,
    source_iso639_2t: str | None,
    lookup: Callable[[str], Literal["lesson", "language"] | None],
    progress: Callable[[int, int], None] | None = None,
) -> BuildResult:
    target = get_language_by_iso2t(target_iso639_2t or "")
    source = get_language_by_iso2t(source_iso639_2t or "")
    iso1 = None if target.iso1 == "unknown" else target.iso1
    target_name = "the target language" if iso1 is None else target.name
    source_name = None if source.iso1 == "unknown" else source.name

    chunks = chunk_document(doc)
    result = BuildResult()
    if not chunks:
        result.warnings.append("No text was found in the document")
        return result

    failed = 0
    seen: set[str] = set()  # the same word in a table and a list is one candidate; the first occurrence wins
    for i, chunk in enumerate(chunks, start=1):
        try:
            for item in extract_chunk(chunk, api, target_name, source_name):
                if normalise(item.word) not in seen:
                    seen.add(normalise(item.word))
                    result.candidates.append(verify(item, chunk, iso1, lookup))
        except ExtractionError as e:
            failed += 1
            result.warnings.append(f"page {chunk.page + 1}: could not read the model's answer ({e})")
        except ModelAPIError as e:
            if e.kind in _ABORT_KINDS:
                raise
            failed += 1
            result.warnings.append(f"page {chunk.page + 1}: model call failed ({e.message})")
        if progress:
            progress(i, len(chunks))

    if failed == len(chunks):
        raise ExtractionError("Extraction failed for every page")
    return result
