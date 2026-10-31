"""Say which kinds of content each page of a book holds. The model proposes; the user has the last word."""
import logging

from ...utils.model_api import ModelAPIError, chat_completion
from ..parsing.types import Document
from .extract import _parse_json
from .structure import BATCH_PAGES, PAGE_PEEK_CHARS, _ABORT_KINDS, page_texts
from .types import ALL_KINDS, Kind

logger = logging.getLogger(__name__)

_SYSTEM = (
    "You are given the beginning of each page of a language-learning book. For each page list which kinds of "
    f"content it holds, from this fixed set: {', '.join(ALL_KINDS)}. vocabulary = word lists or glossaries; "
    "grammar = grammar explanations; calligraphy = pages teaching how to write a single character: stroke order, radicals, practice grids, character breakdowns; "
    "exercise = numbered tasks/questions for the learner to answer (fill-in blanks, multiple choice, "
    "matching, true/false, translate, reorder, essay/speaking prompts). Use [] for covers, contents pages and blank pages. "
    "If unsure, include the kind. "
    'Reply with ONLY a JSON array: [{"page": <page number as shown>, "kinds": ["vocabulary", ...]}].'
)


def classify_pages(doc: Document, api: dict, target_name: str) -> dict[int, list[Kind]]:
    """1-based page number -> its kinds, for every page. Anything unanswered counts as every kind."""
    texts = page_texts(doc)
    numbers = sorted(texts)
    result: dict[int, list[Kind]] = {}
    for i in range(0, len(numbers), BATCH_PAGES):
        batch = numbers[i:i + BATCH_PAGES]
        result.update(_ask_batch(batch, texts, api, target_name) or {})
    return {n: result.get(n, list(ALL_KINDS)) for n in numbers}


def _ask_batch(batch: list[int], texts: dict[int, str], api: dict, target_name: str) -> dict[int, list[Kind]] | None:
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
            logger.warning("Classify call failed: %s", e)
            return None
        data = _parse_json(reply)
        if isinstance(data, list):
            valid = set(batch)
            return {i["page"]: _known(i["kinds"]) for i in data
                    if isinstance(i, dict) and isinstance(i.get("page"), int) and i["page"] in valid
                    and isinstance(i.get("kinds"), list)}
    return None


def _known(kinds: list) -> list[Kind]:
    """The recognised kinds; a non-empty reply with none of them is unreadable, so every kind. A real [] stays."""
    known = [k for k in ALL_KINDS if k in kinds]
    return known or ([] if not kinds else list(ALL_KINDS))


def validate_page_kinds(raw, first_page: int, last_page: int,
                        stored: dict | None = None) -> tuple[dict[int, list[str]] | None, str | None]:
    """Validate and normalize page kinds mapping.
    Returns (every page of the range with kinds, None) or (None, error reason).
    JSON keys are strings. Pages left out keep their stored kinds, else every kind.
    Legacy kinds (passage, character) are silently filtered out."""
    if not isinstance(raw, dict):
        return None, "page_kinds must be an object of page -> kinds"
    clean: dict[int, list[str]] = {}
    for page, kinds in raw.items():
        if not (isinstance(page, int) and not isinstance(page, bool) or isinstance(page, str) and page.isdigit()):
            return None, f'Page "{page}" is not a whole number'
        page = int(page)
        if not first_page <= page <= last_page:
            return None, f"Page {page} is outside {first_page}-{last_page}"
        if not isinstance(kinds, list) or any(not isinstance(k, str) for k in kinds):
            return None, f"Page {page}: kinds must be a list of strings"
        # Filter to only known kinds, silently dropping legacy kinds (passage, character)
        valid_kinds = [k for k in kinds if k in ALL_KINDS]
        # If some kinds were dropped and nothing valid remains, it's an error
        if kinds and not valid_kinds:
            # Check if it was only legacy kinds or unknown kinds
            legacy_kinds = {"passage", "character"}
            unknown = [k for k in kinds if k not in ALL_KINDS and k not in legacy_kinds]
            if unknown:
                return None, f"Page {page}: unknown kinds {unknown}"
        clean[page] = valid_kinds
    stored = stored or {}
    return {n: clean.get(n, stored.get(str(n), list(ALL_KINDS))) for n in range(first_page, last_page + 1)}, None
