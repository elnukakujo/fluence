import base64

import numpy as np
import pytest

from lapp.services.parsing import ocr as ocr_module
from lapp.services.parsing.ocr import RemoteOcrEngine
from lapp.services.parsing.types import ParseError
from lapp.utils import model_api

PNG_B64 = base64.b64encode(b"\x89PNG fake bytes").decode()
CONTENT = [{"type": "text", "text": "Transcribe this page."},
           {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{PNG_B64}"}}]


class FakeClient:
    """Stands in for httpx.Client: records the POST and returns a canned reply."""
    sent: dict = {}
    reply: dict = {}

    def __init__(self, *a, **kw):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def post(self, path, json=None):
        FakeClient.sent = {"path": path, "json": json}

        class R:
            def raise_for_status(self): pass
            def json(self_inner): return FakeClient.reply
        return R()


@pytest.fixture(autouse=True)
def fake_http(monkeypatch):
    monkeypatch.setattr(model_api.httpx, "Client", FakeClient)
    FakeClient.sent, FakeClient.reply = {}, {}


def _chat(fmt, messages):
    return model_api.chat_completion("https://x/v1", "k", "m", messages, 100, api_format=fmt,
                                     auth_type="x-api-key" if fmt == "anthropic" else "param")


def test_anthropic_image_part_becomes_a_base64_source_block():
    FakeClient.reply = {"content": [{"text": "bonjour"}]}
    assert _chat("anthropic", [{"role": "user", "content": CONTENT}]) == "bonjour"
    parts = FakeClient.sent["json"]["messages"][0]["content"]
    assert parts[0] == {"type": "text", "text": "Transcribe this page."}
    assert parts[1] == {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": PNG_B64}}


def test_gemini_image_part_becomes_inline_data():
    FakeClient.reply = {"candidates": [{"content": {"parts": [{"text": "bonjour"}]}}]}
    assert _chat("gemini", [{"role": "user", "content": CONTENT}]) == "bonjour"
    parts = FakeClient.sent["json"]["contents"][0]["parts"]
    assert parts[0] == {"text": "Transcribe this page."}
    assert parts[1] == {"inline_data": {"mime_type": "image/png", "data": PNG_B64}}


def test_plain_string_messages_are_unchanged_for_both_formats():
    FakeClient.reply = {"content": [{"text": "ok"}]}
    _chat("anthropic", [{"role": "system", "content": "be brief"}, {"role": "user", "content": "hi"}])
    assert FakeClient.sent["json"]["system"] == "be brief" and FakeClient.sent["json"]["messages"] == [{"role": "user", "content": "hi"}]
    FakeClient.reply = {"candidates": [{"content": {"parts": [{"text": "ok"}]}}]}
    _chat("gemini", [{"role": "user", "content": "hi"}])
    assert FakeClient.sent["json"]["contents"][0]["parts"] == [{"text": "hi"}]


def test_a_non_data_image_url_is_rejected_for_these_formats():
    bad = [{"type": "image_url", "image_url": {"url": "https://example.com/x.png"}}]
    with pytest.raises(model_api.ModelAPIError):
        _chat("anthropic", [{"role": "user", "content": bad}])


IMG = np.full((40, 80, 3), 255, np.uint8)


@pytest.mark.parametrize("fmt", ["anthropic", "gemini"])
def test_remote_engine_accepts_anthropic_and_gemini_and_folds_the_instruction_into_the_user_turn(monkeypatch, fmt):
    calls = []
    monkeypatch.setattr(ocr_module, "chat_completion", lambda **kw: calls.append(kw) or "bonjour\n[[END]]")
    engine = RemoteOcrEngine({"base_url": "https://x", "api_key": "k", "model": "m", "api_format": fmt})
    assert [b.text for b in engine.ocr(IMG, "fra", (80, 40))] == ["bonjour"]
    messages = calls[0]["messages"]
    assert [m["role"] for m in messages] == ["user"] and calls[0]["api_format"] == fmt
    text = messages[0]["content"][0]["text"]
    assert "verbatim" in text and "Transcribe this page." in text
    assert any(p["type"] == "image_url" for p in messages[0]["content"])


@pytest.mark.parametrize("fmt", ["elevenlabs", "google_tts"])
def test_remote_engine_still_rejects_non_vision_formats(fmt):
    with pytest.raises(ParseError) as e:
        RemoteOcrEngine({"base_url": "https://x", "api_key": "k", "model": "m", "api_format": fmt})
    assert e.value.code == "remote_unsupported"


def test_probe_vision_uses_the_given_format(monkeypatch):
    seen = {}
    monkeypatch.setattr(model_api, "chat_completion", lambda **kw: seen.update(kw) or "FLUENCE")
    assert model_api.probe_vision("https://x", "k", "m", "x-api-key", api_format="anthropic") == "reads_images"
    assert seen["api_format"] == "anthropic"
