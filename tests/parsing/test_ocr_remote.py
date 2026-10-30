from types import SimpleNamespace

import numpy as np
import pytest
from pydantic import ValidationError

from lapp.schemas.system_data.user_preferences import ApiEndpoint
from lapp.services.parsing import ocr as ocr_module
from lapp.services.parsing.ocr import END, NO_TEXT, RemoteOcrEngine
from lapp.services.parsing.types import ParseError
from lapp.utils.llm_providers import resolve_api

API = {"base_url": "https://x/v1", "api_key": "k", "model": "m", "api_format": "openai", "auth_type": "bearer"}
IMG = np.full((40, 80, 3), 255, np.uint8)


def _engine(monkeypatch, reply):
    calls = []

    def fake(**kw):
        calls.append(kw)
        return reply

    monkeypatch.setattr(ocr_module, "chat_completion", fake)
    return RemoteOcrEngine(API), calls


def test_ocr_api_type_accepted_and_bogus_rejected():
    assert ApiEndpoint(api_type="ocr").api_type == "ocr"
    with pytest.raises(ValidationError):
        ApiEndpoint(api_type="bogus")


def _prefs(*endpoints, **legacy):
    return SimpleNamespace(ai_endpoints=list(endpoints), ai_gen_api_base_url="https://legacy/v1",
                           ai_gen_api_key="k", ai_gen_model="m", **legacy)


def test_resolve_api_ocr_ignores_other_types_and_legacy_fields():
    ep = {"is_active": True, "base_url": "u", "model": "m"}
    prefs = _prefs({**ep, "api_type": "text_gen"}, {**ep, "api_type": "both"})
    assert resolve_api(prefs, "ocr") is None
    assert resolve_api(_prefs({**ep, "api_type": "ocr", "model": "vision"}), "ocr")["model"] == "vision"
    assert resolve_api(prefs, "text_gen") is not None  # unchanged behaviour


def test_remote_engine_rejects_non_openai_format():
    with pytest.raises(ParseError) as e:
        RemoteOcrEngine({**API, "api_format": "anthropic"})
    assert e.value.code == "remote_unsupported"


def test_remote_engine_sends_image_as_data_url(monkeypatch):
    engine, calls = _engine(monkeypatch, f"bonjour\n{END}")
    engine.ocr(IMG, "fra", (80, 40))
    messages = calls[0]["messages"]
    assert messages[0]["role"] == "system"
    assert "verbatim" in messages[0]["content"] and "do not translate" in messages[0]["content"].lower()
    parts = messages[1]["content"]
    assert next(p for p in parts if p["type"] == "image_url")["image_url"]["url"].startswith("data:image/png;base64,")
    assert calls[0]["temperature"] == 0


def test_remote_blocks_have_no_confidence_or_fake_boxes(monkeypatch):
    engine, _ = _engine(monkeypatch, f"bonjour\nmerci\n{END}")
    blocks = engine.ocr(IMG, "fra", (80, 40))
    assert [b.text for b in blocks] == ["bonjour", "merci"]
    assert all(b.words == [] and b.bbox == (0, 0, 80, 40) for b in blocks)


@pytest.mark.parametrize("reply", ["", "  \n ", NO_TEXT])
def test_remote_empty_response_returns_no_blocks(monkeypatch, reply):
    engine, _ = _engine(monkeypatch, reply)
    assert engine.ocr(IMG, "fra", (80, 40)) == []


@pytest.mark.parametrize("reply", ["bonjour le monde", "I'm sorry, I can't read this image.", "bonjour\nmer"])
def test_remote_reply_without_end_marker_is_rejected(monkeypatch, reply):
    # truncated output and polite refusals both lack the terminator the prompt demands
    engine, _ = _engine(monkeypatch, reply)
    with pytest.raises(ParseError) as e:
        engine.ocr(IMG, "fra", (80, 40))
    assert e.value.code == "ocr_incomplete"


def test_end_marker_is_not_part_of_the_text(monkeypatch):
    engine, _ = _engine(monkeypatch, f"bonjour\n{END}")
    assert [b.text for b in engine.ocr(IMG, "fra", (80, 40))] == ["bonjour"]
