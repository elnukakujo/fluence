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
        if not result.word_results:
            return []
        sx, sy = size[0] / image.shape[1], size[1] / image.shape[0]
        words = []
        for box_words in result.word_results:   # one tuple per detected box, possibly several words
            for text, conf, quad in box_words:
                xs, ys = [p[0] for p in quad], [p[1] for p in quad]
                words.append(Word(text=text, conf=float(conf),
                                  bbox=(min(xs) * sx, min(ys) * sy, max(xs) * sx, max(ys) * sy)))
        return _group_lines(words)


def _group_lines(words: list[Word]) -> list[Block]:
    """Group word boxes into one Block per visual line (reading order)."""
    lines: list[list[Word]] = []
    for w in sorted(words, key=lambda w: (w.bbox[1] + w.bbox[3]) / 2):
        mid, height = (w.bbox[1] + w.bbox[3]) / 2, w.bbox[3] - w.bbox[1]
        for line in lines:
            ref = line[0].bbox
            if abs(mid - (ref[1] + ref[3]) / 2) <= max(height, ref[3] - ref[1]) / 2:
                line.append(w)
                break
        else:
            lines.append([w])
    blocks = []
    for line in lines:
        line.sort(key=lambda w: w.bbox[0])
        box = (min(w.bbox[0] for w in line), min(w.bbox[1] for w in line),
               max(w.bbox[2] for w in line), max(w.bbox[3] for w in line))
        blocks.append(Block(text=" ".join(w.text for w in line), bbox=box, kind="body", words=line))
    return blocks


NO_TEXT = "[[NO_TEXT]]"
_SYSTEM = (
    "You are an OCR engine. Transcribe the text in the image verbatim, line by line, exactly as written, "
    "preserving spelling, accents and scripts. Do not translate, correct, complete, explain or add anything. "
    f"If a word is illegible write [?] in its place. If the image has no legible text, reply exactly {NO_TEXT}."
)


class RemoteOcrEngine:
    """Last-resort fallback: a vision LLM reading the page via the user's own "ocr" endpoint.

    Output is a model's reading, not a measurement: callers must label it `llm_transcribed` and no
    confidence or word boxes exist. `api` is the dict from llm_providers.resolve_api(prefs, "ocr").
    """

    def __init__(self, api: dict):
        if (api.get("api_format") or "openai") != "openai":
            raise ParseError("unsupported", "Remote OCR needs an OpenAI-format endpoint (image input)")
        self._api = api

    def ocr(self, image: np.ndarray, iso2t: str | None, size: tuple[float, float]) -> list[Block]:
        ok, png = cv2.imencode(".png", image)
        if not ok:
            raise ParseError("corrupt", "Could not encode the page image")
        url = "data:image/png;base64," + base64.b64encode(png.tobytes()).decode()
        text = chat_completion(
            base_url=self._api["base_url"], api_key=self._api.get("api_key", ""), model=self._api["model"],
            api_format="openai", auth_type=self._api.get("auth_type", "bearer"),
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": [
                    {"type": "text", "text": "Transcribe this page."},
                    {"type": "image_url", "image_url": {"url": url}},
                ]},
            ],
            max_tokens=4096, temperature=0, timeout=120,
        )
        # ponytail: weak guard - only empty / NO_TEXT is caught; a polite refusal still passes as text
        lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
        if not lines or lines == [NO_TEXT]:
            return []
        page_box = (0.0, 0.0, size[0], size[1])  # the model gives no positions
        return [Block(text=ln, bbox=page_box, kind="body", words=[]) for ln in lines]
