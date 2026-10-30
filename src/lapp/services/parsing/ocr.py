"""OCR engines and the language -> recognizer table.

Adding a language: put its ISO 639-1 code in SCRIPT_BY_ISO1 (and, for a brand-new script family,
one RECOGNIZERS entry). Un-deferring a script is moving its codes from DEFERRED_ISO1 to
SCRIPT_BY_ISO1. test_ocr_languages.py fails until every app language is in exactly one of the two.
"""
import base64
import os
from typing import Protocol

import cv2
import numpy as np
from rapidocr import LangRec, ModelType, OCRVersion, RapidOCR

from ...utils.detect_language import get_language_by_iso2t
from ...utils.model_api import chat_completion
from .types import Block, ParseError, Word

# (ocr_version, model_type, lang) - see docs/superpowers/specs/2026-10-30-document-parser-ocr-models.md
_MULTI = ("PP-OCRv6", "small", "ch")      # Latin + Han + kana; bundled in the rapidocr wheel
_KOREAN = ("PP-OCRv5", "mobile", "korean")  # v6 drops Hangul; downloaded on first use
RECOGNIZERS: dict[str, tuple[str, str, str]] = {
    "latin": _MULTI, "ch": _MULTI, "japan": _MULTI, "korean": _KOREAN,
}

_LATIN = ["ca", "hr", "da", "nl", "en", "fi", "fr", "de", "it", "lt", "nb", "no", "pl", "pt", "ro", "sl", "es", "sv"]
SCRIPT_BY_ISO1: dict[str, str] = {**dict.fromkeys(_LATIN, "latin"), "zh": "ch", "ja": "japan", "ko": "korean"}
DEFERRED_ISO1: frozenset[str] = frozenset({"ru", "uk", "mk", "el"})  # Cyrillic, Greek: not supported yet

OCR_THREADS = int(os.environ.get("LAPP_OCR_THREADS", "2"))


def script_for(iso2t: str | None) -> str | None:
    """Recognizer family for a language; None when unknown/Custom; ParseError when deferred."""
    lang = get_language_by_iso2t(iso2t or "")
    if lang.iso1 in DEFERRED_ISO1:
        raise ParseError("ocr_language_unsupported", f"OCR for {lang.name} is not supported yet")
    return SCRIPT_BY_ISO1.get(lang.iso1)


class OcrEngine(Protocol):
    def ocr(self, image: np.ndarray, iso2t: str | None, size: tuple[float, float]) -> list[Block]:
        """Read `image` (BGR or gray); bboxes are returned in `size` (page width, height) units."""


class RapidOcrEngine:
    """Local CPU OCR. One lazily-built model per distinct recognizer selector (not per family)."""

    def __init__(self) -> None:
        self._models: dict[tuple[str, str, str], RapidOCR] = {}

    def _model_for(self, iso2t: str | None) -> RapidOCR:
        family = script_for(iso2t)
        sel = RECOGNIZERS[family] if family else _MULTI
        if sel not in self._models:
            version, model_type, lang = sel
            self._models[sel] = RapidOCR(params={
                "Rec.ocr_version": OCRVersion(version),
                "Rec.model_type": ModelType(model_type),
                "Rec.lang_type": LangRec(lang),
                "EngineConfig.onnxruntime.intra_op_num_threads": OCR_THREADS,
                "EngineConfig.onnxruntime.inter_op_num_threads": 1,
            })
        return self._models[sel]

    def ocr(self, image: np.ndarray, iso2t: str | None, size: tuple[float, float]) -> list[Block]:
        result = self._model_for(iso2t)(image, return_word_box=True)
        if not result.txts or not result.word_results:
            return []
        sx, sy = size[0] / image.shape[1], size[1] / image.shape[0]
        blocks = []
        # one Block per line the detector found; its own text keeps correct spacing (CJK word boxes are per character)
        for text, line_words in zip(result.txts, result.word_results):
            words = []
            for word, conf, quad in line_words:
                xs, ys = [p[0] for p in quad], [p[1] for p in quad]
                words.append(Word(text=word, conf=float(conf),
                                  bbox=(min(xs) * sx, min(ys) * sy, max(xs) * sx, max(ys) * sy)))
            if not words:
                continue
            box = (min(w.bbox[0] for w in words), min(w.bbox[1] for w in words),
                   max(w.bbox[2] for w in words), max(w.bbox[3] for w in words))
            blocks.append(Block(text=text, bbox=box, kind="body", words=words))
        return _reading_order(blocks)


def group_lines(blocks: list[Block]) -> list[list[Block]]:
    """Group blocks into visual lines (top-to-bottom), each line sorted left-to-right."""
    lines: list[list[Block]] = []
    for b in sorted(blocks, key=lambda b: (b.bbox[1] + b.bbox[3]) / 2):
        mid, height = (b.bbox[1] + b.bbox[3]) / 2, b.bbox[3] - b.bbox[1]
        for line in lines:
            ref = line[0].bbox
            if abs(mid - (ref[1] + ref[3]) / 2) <= max(height, ref[3] - ref[1]) / 2:
                line.append(b)
                break
        else:
            lines.append([b])
    return [sorted(line, key=lambda b: b.bbox[0]) for line in lines]


def _reading_order(blocks: list[Block]) -> list[Block]:
    """The detector's own box order is not reliable (it returned "bonjour monde le")."""
    return [b for line in group_lines(blocks) for b in line]


NO_TEXT = "[[NO_TEXT]]"
END = "[[END]]"
_SYSTEM = (
    "You are an OCR engine. Transcribe the text in the image verbatim, line by line, exactly as written, "
    "preserving spelling, accents and scripts. Do not translate, correct, complete, explain or add anything. "
    f"If a word is illegible write [?] in its place. End your reply with {END} on its own line. "
    f"If the image has no legible text, reply exactly {NO_TEXT}."
)


_VISION_FORMATS = ("openai", "anthropic", "gemini")
_USER_PROMPT = "Transcribe this page."


class RemoteOcrEngine:
    """Last-resort fallback: a vision LLM reading the page via the user's own "ocr" endpoint.

    Output is a model's reading, not a measurement: callers must label it `llm_transcribed` and no
    confidence or word boxes exist. `api` is the dict from llm_providers.resolve_api(prefs, "ocr").
    """

    def __init__(self, api: dict):
        if (api.get("api_format") or "openai") not in _VISION_FORMATS:
            raise ParseError("remote_unsupported", "Remote OCR needs an OpenAI, Anthropic or Gemini endpoint (image input)")
        self._api = api
        self.cache_id = f"{api['base_url']}|{api['model']}"  # part of the parse cache key; never the API key

    def ocr(self, image: np.ndarray, iso2t: str | None, size: tuple[float, float]) -> list[Block]:
        ok, png = cv2.imencode(".png", image)
        if not ok:
            raise ParseError("corrupt", "Could not encode the page image")
        url = "data:image/png;base64," + base64.b64encode(png.tobytes()).decode()
        fmt = self._api.get("api_format") or "openai"
        image_part = {"type": "image_url", "image_url": {"url": url}}
        if fmt == "openai":
            messages = [{"role": "system", "content": _SYSTEM},
                        {"role": "user", "content": [{"type": "text", "text": _USER_PROMPT}, image_part]}]
        else:   # Anthropic / Gemini: one user turn, so we don't depend on each provider's system-prompt handling
            messages = [{"role": "user", "content": [{"type": "text", "text": f"{_SYSTEM}\n\n{_USER_PROMPT}"}, image_part]}]
        text = chat_completion(
            base_url=self._api["base_url"], api_key=self._api.get("api_key", ""), model=self._api["model"],
            api_format=fmt, auth_type=self._api.get("auth_type", "bearer"),
            messages=messages, max_tokens=4096, temperature=0, timeout=120,
        )
        text = (text or "").strip()
        if not text or text == NO_TEXT:
            return []
        if not text.endswith(END):  # truncated by max_tokens, or a refusal/chatter: never present as a transcription
            raise ParseError("ocr_incomplete", "Remote OCR reply was cut short or not a transcription")
        lines = [ln.strip() for ln in text[: -len(END)].splitlines() if ln.strip()]
        if not lines:
            return []
        page_box = (0.0, 0.0, size[0], size[1])  # the model gives no positions
        return [Block(text=ln, bbox=page_box, kind="body", words=[]) for ln in lines]
