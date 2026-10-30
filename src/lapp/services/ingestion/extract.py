"""Ask the user's own text model for vocabulary in one chunk. Output is untrusted until verify()."""
import json
import logging
import re

from pydantic import BaseModel, ValidationError, field_validator

from ...utils.model_api import chat_completion
from .types import Chunk

logger = logging.getLogger(__name__)

MAX_TOKENS = 2048


class ExtractionError(Exception):
    """The model never produced parseable JSON for this chunk."""


class RawItem(BaseModel):
    word: str
    quote: str
    translation: str | None = None
    phonetic: str | None = None
    word_type: str | None = None

    @field_validator("word", "quote")
    @classmethod
    def _non_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("empty")
        return v.strip()

    @field_validator("translation", "phonetic", "word_type")
    @classmethod
    def _blank_is_none(cls, v: str | None) -> str | None:
        return (v or "").strip() or None


def _system_prompt(target: str, source: str | None) -> str:
    gloss = f" Translations, when the text gives them, are in {source}." if source else ""
    return (
        f"You extract {target} vocabulary from text that comes from a language-learning document.{gloss}\n"
        "Rules:\n"
        "- Extract only words and phrases that actually appear in the text. Invent nothing: no extra words, "
        "no translations the text does not give (use null), no corrections.\n"
        "- For every item give a `quote`: a short span copied verbatim from the text that contains the word.\n"
        "- Reply with ONLY a JSON array, no prose. Each item: "
        '{"word": str, "translation": str|null, "phonetic": str|null, "word_type": str|null, "quote": str}.\n'
        "- If the text has no vocabulary, reply []."
    )


def extract_chunk(chunk: Chunk, api: dict, target_name: str, source_name: str | None = None) -> list[RawItem]:
    messages = [
        {"role": "system", "content": _system_prompt(target_name, source_name)},
        {"role": "user", "content": chunk.text},
    ]
    for attempt in (1, 2):
        reply = chat_completion(
            base_url=api["base_url"], api_key=api.get("api_key", ""), model=api["model"],
            api_format=api.get("api_format", "openai"), auth_type=api.get("auth_type", "bearer"),
            messages=messages, max_tokens=MAX_TOKENS, temperature=0,
        )
        data = _parse_json(reply)
        if data is not None:
            return _validated(data)
        logger.warning("Chunk %s: unparseable extraction reply (attempt %s)", chunk.id, attempt)
    raise ExtractionError(f"No valid JSON for chunk {chunk.id}")


def _parse_json(reply: str):
    text = re.sub(r"```(?:json)?", "", reply or "")
    for opener, closer in (("[", "]"), ("{", "}")):
        start, end = text.find(opener), text.rfind(closer)
        if start != -1 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except ValueError:
                continue
    return None


def _validated(data) -> list[RawItem]:
    items = []
    for raw in data if isinstance(data, list) else [data]:
        try:
            items.append(RawItem.model_validate(raw))
        except ValidationError:
            logger.info("Dropping malformed extraction item: %r", raw)
    return items
