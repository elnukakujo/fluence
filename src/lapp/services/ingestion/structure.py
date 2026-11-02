"""Find where the lessons of a book start. The model proposes; the text confirms; the user has the last word."""
import logging
from pathlib import Path

from pydantic import BaseModel

from ...utils.model_api import ModelAPIError, chat_completion
from ..parsing.types import Document
from .chunk import _lines
from .extract import _parse_json
from .verify import normalise

logger = logging.getLogger(__name__)

PAGE_PEEK_CHARS = 200   # how much of each page the model sees: titles are at the top
BATCH_PAGES = 40
_ABORT_KINDS = {ModelAPIError.KIND_AUTH, ModelAPIError.KIND_NOT_FOUND}

_SYSTEM = (
    "You are given the beginning of each page of a language-learning book. List the pages where a NEW lesson "
    "(or unit / chapter) starts, with its title exactly as printed on that page. Invent nothing; skip pages that "
    "only continue a lesson, and skip contents pages, covers and indexes. Reply with ONLY a JSON array: "
    '[{"page": <page number as shown>, "title": "<title as printed>"}]. If there is no lesson start, reply [].'
)


class LessonProposal(BaseModel):
    title: str
    start_page: int          # 1-based document page numbers
    end_page: int
    verified: bool = True    # the title was found on its start page
    note: str | None = None


def page_texts(doc: Document) -> dict[int, str]:
    """1-based document page number -> its text."""
    return {p.index + 1: "\n".join(text for text, _, _ in _lines(p) if text.strip()) for p in doc.pages}


def propose_structure(doc: Document, api: dict, target_name: str, filename: str) -> tuple[list[LessonProposal], list[str]]:
    texts = page_texts(doc)
    numbers = sorted(texts)
    warnings: list[str] = []
    found: dict[int, str] = {}
    for i in range(0, len(numbers), BATCH_PAGES):
        batch = numbers[i:i + BATCH_PAGES]
        starts = _ask_batch(batch, texts, api, target_name)
        if starts is None:
            warnings.append(f"Could not read the model's answer for pages {batch[0]}-{batch[-1]}")
            continue
        for page, title in starts:
            found.setdefault(page, title)

    if not found:
        warnings.append("No lesson boundaries were found: the whole document is proposed as one lesson")
        return [LessonProposal(title=Path(filename).stem or "Imported lesson", start_page=numbers[0], end_page=numbers[-1],
                               verified=False, note="No lesson boundaries found - edit the pages if this is several lessons")], warnings

    starts = sorted(found)
    proposals = []
    for n, start in enumerate(starts):
        end = starts[n + 1] - 1 if n + 1 < len(starts) else numbers[-1]
        ok = normalise(found[start]) in normalise(texts[start])
        proposals.append(LessonProposal(title=found[start], start_page=start, end_page=end, verified=ok,
                                        note=None if ok else "This title was not found on its start page - check it"))
    return proposals, warnings


def _ask_batch(batch: list[int], texts: dict[int, str], api: dict, target_name: str) -> list[tuple[int, str]] | None:
    body = "\n\n".join(f"[page {n}]\n{texts[n][:PAGE_PEEK_CHARS]}" for n in batch)
    messages = [{"role": "system", "content": _SYSTEM + f" The book teaches {target_name}."},
                {"role": "user", "content": body}]
    for _ in range(2):
        try:
            reply = chat_completion(
                base_url=api["base_url"], api_key=api.get("api_key", ""), model=api["model"],
                api_format=api.get("api_format", "openai"), auth_type=api.get("auth_type", "bearer"),
                messages=messages, max_tokens=1024, temperature=0, disable_thinking=True,
            )
        except ModelAPIError as e:
            if e.kind in _ABORT_KINDS:
                raise
            logger.warning("Structure call failed: %s", e)
            return None
        data = _parse_json(reply)
        if isinstance(data, list):
            valid = set(batch)
            return [(int(i["page"]), i["title"].strip()) for i in data
                    if isinstance(i, dict) and isinstance(i.get("page"), int) and i["page"] in valid
                    and isinstance(i.get("title"), str) and i["title"].strip()]
    return None


def _whole(n) -> bool:
    return isinstance(n, int) and not isinstance(n, bool)


def normalize_ranges(raw, first_page: int = 1, last_page: int | None = None) -> tuple[list[list[int]] | None, str | None]:
    """A list of `[start, end]` (or `{start_page, end_page}`) -> (sorted ranges, None) or (None, reason).
    Touching ranges (`[1,5],[6,9]`) are fine; overlapping ones are not."""
    if not isinstance(raw, list) or not raw:
        return None, "Give at least one page range"
    ranges = []
    for item in raw:
        if isinstance(item, dict):
            item = [item.get("start_page"), item.get("end_page")]
        if not (isinstance(item, (list, tuple)) and len(item) == 2 and all(_whole(n) for n in item)):
            return None, "Page ranges must be whole numbers"
        start, end = item
        if start < first_page or end < start or (last_page is not None and end > last_page):
            where = f"within {first_page}-{last_page} and " if last_page is not None else ""
            return None, f"Pages {start}-{end} must be {where}end on or after the first page (from page {first_page})"
        ranges.append([start, end])
    ranges.sort()
    for a, b in zip(ranges, ranges[1:]):
        if b[0] <= a[1]:
            return None, f"Pages {a[0]}-{a[1]} and {b[0]}-{b[1]} overlap"
    return ranges, None


def pages_in_ranges(ranges: list[list[int]], page: int) -> bool:
    return any(start <= page <= end for start, end in ranges)


def lesson_ranges(lesson: dict) -> list[list[int]]:
    """A stored structure lesson's ranges (older jobs only have start_page/end_page)."""
    return lesson.get("ranges") or [[lesson["start_page"], lesson["end_page"]]]


def validate_structure(lessons, first_page: int, last_page: int) -> tuple[list[dict] | None, str | None]:
    """The user's edited structure -> (clean, sorted lessons, None) or (None, reason).
    A lesson gives `ranges` or the legacy `start_page`/`end_page`; ranges may not overlap, within or across lessons."""
    if not isinstance(lessons, list) or not lessons:
        return None, "Add at least one lesson"
    clean = []
    for item in lessons:
        item = item if isinstance(item, dict) else {}
        title = str(item.get("title") or "").strip()
        if not title:
            return None, "Every lesson needs a title"
        raw = item.get("ranges") if item.get("ranges") is not None else [[item.get("start_page"), item.get("end_page")]]
        ranges, error = normalize_ranges(raw, first_page, last_page)
        if error:
            return None, f"“{title}”: {error}"
        clean.append({"title": title, "start_page": ranges[0][0], "end_page": ranges[-1][1], "ranges": ranges})
    spans = sorted(((r[0], r[1], c["title"]) for c in clean for r in c["ranges"]))
    for (_, end, a), (start, _, b) in zip(spans, spans[1:]):
        if start <= end:
            return None, f"“{a}” and “{b}” overlap" if a != b else f"“{a}” has overlapping ranges"
    clean.sort(key=lambda c: c["start_page"])
    return clean, None
