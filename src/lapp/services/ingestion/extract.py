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
    tr = "str (never null)" if source else "str|null"
    if source:
        translate = (
            f"- Use the translation the text gives. If the entry has none (a manual written only in {target}), "
            f"write a short, common {source} translation yourself; it is reviewed by a person, never trusted. Never leave `translation` null.\n"
        )
    else:
        translate = "- If the text gives no translation for an entry, leave that entry out.\n"
    return (
        f"You extract {target} vocabulary from text that comes from a language-learning document.\n"
        "Rules:\n"
        "- Extract only vocabulary the text presents as an entry (a word list, glossary, table row or "
        "word-and-phrase summary). Skip words that only occur inside example sentences, dialogues, grammar notes or exercises, and skip contents pages, headings, section titles and page headers.\n"
        f"{translate}"
        "- Invent nothing else: no extra entries, no corrections.\n"
        "- For every item give a `quote`: a short span copied verbatim from the text that contains the word.\n"
        "- Reply with ONLY a JSON array, no prose. Each item: "
        f'{{"word": str, "translation": {tr}, "phonetic": str|null, "word_type": str|null, "quote": str}}.\n'
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
            messages=messages, max_tokens=MAX_TOKENS, temperature=0, disable_thinking=True,
        )
        data = _parse_json(reply)
        if data is not None:
            return _validated(data)
        logger.warning("Chunk %s: unparseable extraction reply (attempt %s)", chunk.id, attempt)
    if not (reply or "").strip():
        raise ExtractionError(f"The model returned no text for chunk {chunk.id} (a reasoning model may have run out of tokens)")
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
            item = RawItem.model_validate(raw)
        except ValidationError:
            logger.info("Dropping malformed extraction item: %r", raw)
            continue
        if item.translation:  # an entry without any translation is not an import candidate, whatever the model says
            items.append(item)
    return items
