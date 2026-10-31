"""Passage, grammar and character extraction and deterministic verification (vocabulary lives in extract/verify)."""
import logging
import uuid

from ...utils.model_api import chat_completion
from ...utils.phonetics import get_phonetic
from ..parsing.pipeline import LOW_WORD_CONF
from .extract import MAX_TOKENS, ExtractionError, _parse_json
from .types import Chunk, ElementCandidate, Flag, Kind
from .verify import _PHONETIC_LANGS, _min_confidence, _strip_marks, _words_present, normalise

logger = logging.getLogger(__name__)

# kind -> (key field, shape shown to the model, extra rule)
_SHAPES = {
    "passage": ("text", '{"text": str, "translation": str|null, "quote": str}',
                "a passage is a whole reading text or dialogue the document presents, not a single word or a grammar example"),
    "grammar": ("title", '{"title": str, "explanation": str, "example_sentences": [str], "quote": str}',
                "a grammar point is a titled explanation; copy `title` and `explanation` verbatim, never paraphrase; skip points with no explanation"),
    "character": ("character", '{"character": str, "phonetic": str|null, "meaning": str|null, "radical": str|null, "strokes": int|null, "quote": str}',
                  "a character is a single-character entry; give `radical` and `strokes` only if the text states them"),
}


def _system_prompt(kind: Kind, target: str, source: str | None) -> str:
    _, shape, rule = _SHAPES[kind]
    translate = ""
    if kind == "passage":
        translate = (f"- Use the translation the text gives. If it gives none, write a {source} translation yourself; it is reviewed by a person.\n"
                     if source else "- If the text gives no translation, set `translation` to null.\n")
    return (
        f"You extract {target} {kind} elements from text that comes from a language-learning document.\n"
        "Rules:\n"
        f"- {rule}.\n"
        f"{translate}"
        "- Invent nothing else: no extra entries, no corrections.\n"
        "- For every item give a `quote`: a short span copied verbatim from the text.\n"
        f"- Reply with ONLY a JSON array, no prose. Each item: {shape}.\n"
        f"- If the text has none, reply []."
    )


def _clean(kind: Kind, raw) -> dict | None:
    """A validated raw dict, or None if malformed."""
    if not isinstance(raw, dict):
        return None
    key = _SHAPES[kind][0]
    s = lambda v: v.strip() if isinstance(v, str) and v.strip() else None
    if not s(raw.get(key)):
        return None
    out = {k: s(raw.get(k)) for k in ("text", "translation", "title", "explanation", "character", "phonetic", "meaning", "radical", "quote")
           if k in raw or k == key}
    out["quote"] = out.get("quote") or out[key]
    if kind == "grammar":
        ex = raw.get("example_sentences")
        out["example_sentences"] = [e.strip() for e in ex if isinstance(e, str) and e.strip()] if isinstance(ex, list) else []
    if kind == "character":
        st = raw.get("strokes")
        out["strokes"] = st if isinstance(st, int) and not isinstance(st, bool) else None
    return out


def extract_kind(kind: Kind, chunk: Chunk, api: dict, target: str, source: str | None) -> list[dict]:
    messages = [{"role": "system", "content": _system_prompt(kind, target, source)}, {"role": "user", "content": chunk.text}]
    for attempt in (1, 2):
        reply = chat_completion(
            base_url=api["base_url"], api_key=api.get("api_key", ""), model=api["model"],
            api_format=api.get("api_format", "openai"), auth_type=api.get("auth_type", "bearer"),
            messages=messages, max_tokens=MAX_TOKENS, temperature=0, disable_thinking=True,
        )
        data = _parse_json(reply)
        if data is not None:
            items = [_clean(kind, r) for r in (data if isinstance(data, list) else [data])]
            return [i for i in items if i]
        logger.warning("Chunk %s: unparseable %s reply (attempt %s)", chunk.id, kind, attempt)
    if not (reply or "").strip():
        raise ExtractionError(f"The model returned no text for chunk {chunk.id} (a reasoning model may have run out of tokens)")
    raise ExtractionError(f"No valid JSON for chunk {chunk.id}")


def dedupe_key(kind: Kind, fields: dict) -> str:
    return normalise(fields[_SHAPES[kind][0]])


def verify_element(kind: Kind, raw: dict, chunk: Chunk, iso1: str | None) -> ElementCandidate | None:
    """None = drop. Passage/grammar/character only; vocabulary goes through verify.verify."""
    text = normalise(chunk.text)
    flags: list[Flag] = []
    flag = lambda code, msg: flags.append(Flag(code=code, message=msg))
    fields: dict
    key = raw[_SHAPES[kind][0]]

    if kind == "passage":
        fields = {"text": raw["text"], "translation": raw.get("translation")}
        if normalise(raw["text"]) not in text:
            flag("quote_not_in_source", "The passage does not appear in the source text")
        tr = fields["translation"]
        if tr and normalise(tr) not in text and not _words_present(tr, chunk.text):
            flag("translation_generated", "The translation was written by the model, not found in the document - check it")
    elif kind == "grammar":
        if not raw.get("explanation") or normalise(raw["explanation"]) not in text:
            return None
        if normalise(raw["title"]) not in text:
            flag("word_not_in_source", "The title does not appear in the source text")
        fields = {"title": raw["title"], "explanation": raw["explanation"],
                  "example_sentences": [e for e in raw.get("example_sentences", []) if normalise(e) in text]}
    else:
        if normalise(key) not in text:
            return None
        radical, strokes = raw.get("radical"), raw.get("strokes")
        fields = {
            "character": key, "phonetic": raw.get("phonetic"), "meaning": raw.get("meaning"),
            "radical": radical if radical and normalise(radical) in text else None,
            "strokes": strokes if isinstance(strokes, int) and not isinstance(strokes, bool) and strokes > 0 and str(strokes) in text else None,
        }
        if iso1 in _PHONETIC_LANGS and fields["phonetic"]:
            try:
                expected = get_phonetic(key, iso1)
            except Exception:  # a missing optional library must not fail extraction
                logger.exception("Phonetic check failed for %r", key)
                expected = ""
            if expected and _strip_marks(expected) != _strip_marks(fields["phonetic"]):
                flag("phonetic_mismatch", f'The model gave "{fields["phonetic"]}", expected "{expected}"')

    if normalise(raw["quote"]) not in text and not any(f.code == "quote_not_in_source" for f in flags):
        flag("quote_not_in_source", "The quoted passage does not appear in the source text")

    min_conf = _min_confidence(key, chunk)
    if chunk.trust == "ocr" and min_conf is not None and min_conf < LOW_WORD_CONF:
        flag("low_ocr_confidence", f"The OCR was unsure about this text (confidence {min_conf:.2f})")
    if chunk.trust == "llm_transcribed":
        flag("llm_transcribed_source", "This page was transcribed by a vision model, not measured by OCR")

    return ElementCandidate(
        id=uuid.uuid4().hex, kind=kind, fields=fields, quote=raw["quote"], page=chunk.page, chunk_id=chunk.id,
        status="flagged" if any(f.severity == "warning" for f in flags) else "verified", flags=flags, min_conf=min_conf,
    )
