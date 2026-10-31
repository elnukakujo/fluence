"""chunk -> extract -> verify for one parsed Document. DB-free: the caller supplies `exists`."""
import logging
from dataclasses import dataclass, field
from typing import Callable, Literal

from ...utils.detect_language import get_language_by_iso2t
from ...utils.model_api import ModelAPIError
from ..parsing.types import Document
from .chunk import chunk_document
from .elements import dedupe_key, extract_kind, verify_element
from .extract import ExtractionError, extract_chunk
from .types import ALL_KINDS, Candidate, ElementCandidate, Kind
from .verify import normalise, verify

logger = logging.getLogger(__name__)

# Misconfiguration repeats on every chunk; fail the job once instead of once per chunk.
_ABORT_KINDS = {ModelAPIError.KIND_AUTH, ModelAPIError.KIND_NOT_FOUND}


@dataclass
class BuildResult:
    candidates: list[Candidate] = field(default_factory=list)
    elements: list[ElementCandidate] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def build_candidates(
    doc: Document,
    api: dict,
    target_iso639_2t: str | None,
    source_iso639_2t: str | None,
    lookup: Callable[[str], Literal["lesson", "language"] | None],
    progress: Callable[[int, int], None] | None = None,
    page_kinds: dict[int, list[Kind]] | None = None,  # 1-based page -> confirmed kinds; None = vocabulary only
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

    attempted = failed = 0  # chunks with at least one model call / chunks where every call failed
    seen: dict[str, set[str]] = {k: set() for k in ALL_KINDS}  # the first occurrence of a duplicate wins

    def vocabulary(chunk):
        for item in extract_chunk(chunk, api, target_name, source_name):
            if normalise(item.word) not in seen["vocabulary"]:
                seen["vocabulary"].add(normalise(item.word))
                result.candidates.append(verify(item, chunk, iso1, lookup))

    def element(kind):
        def run(chunk):
            for raw in extract_kind(kind, chunk, api, target_name, source_name):
                el = verify_element(kind, raw, chunk, iso1)
                if el and (key := dedupe_key(kind, el.fields)) not in seen[kind]:
                    seen[kind].add(key)
                    result.elements.append(el)
        return run

    def attempt(run, chunk, label) -> bool:
        try:
            run(chunk)
            return True
        except ExtractionError as e:
            result.warnings.append(f"page {chunk.page + 1}{label}: could not read the model's answer ({e})")
        except ModelAPIError as e:
            if e.kind in _ABORT_KINDS:
                raise
            result.warnings.append(f"page {chunk.page + 1}{label}: model call failed ({e.message})")
        return False

    for i, chunk in enumerate(chunks, start=1):
        kinds = ["vocabulary"] if page_kinds is None else page_kinds.get(chunk.page + 1, ALL_KINDS)
        outcomes = [attempt(vocabulary if k == "vocabulary" else element(k), chunk, "" if k == "vocabulary" else f" ({k})")
                    for k in kinds]
        attempted += bool(outcomes)
        failed += bool(outcomes) and not any(outcomes)
        if progress:
            progress(i, len(chunks))

    if attempted and failed == attempted:
        raise ExtractionError("Extraction failed for every page")
    return result
