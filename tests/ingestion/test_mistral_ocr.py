import numpy as np
import pytest

from lapp.schemas.system_data.user_preferences import ApiEndpoint
from lapp.services.parsing import ocr as ocr_module
from lapp.services.parsing.ocr import MistralOcrEngine, RemoteOcrEngine, remote_engine_for
from lapp.services.parsing.types import ParseError
from lapp.utils import model_api
from lapp.utils.llm_providers import PROVIDERS
from lapp.utils.model_api import ModelAPIError

API = {"base_url": "https://api.mistral.ai/v1", "api_key": "k", "model": "mistral-ocr-latest",
       "api_format": "mistral_ocr", "auth_type": "bearer"}
IMG = np.full((40, 80, 3), 255, np.uint8)


class FakeClient:
    sent: dict = {}
    reply: dict = {}
    status_error: Exception | None = None

    def __init__(self, *a, **kw):
        FakeClient.init = kw

    def __enter__(self): return self
    def __exit__(self, *a): return False

    def post(self, path, json=None):
        FakeClient.sent = {"path": path, "json": json}

        class R:
            def raise_for_status(self_inner):
                if FakeClient.status_error:
                    raise FakeClient.status_error
            def json(self_inner): return FakeClient.reply
        return R()


@pytest.fixture(autouse=True)
def fake_http(monkeypatch):
    monkeypatch.setattr(model_api.httpx, "Client", FakeClient)
    FakeClient.sent, FakeClient.reply, FakeClient.status_error = {}, {}, None


def test_ocr_markdown_posts_the_documented_request_and_joins_page_markdown():
    FakeClient.reply = {"pages": [{"index": 0, "markdown": "# Titre"}, {"index": 1, "markdown": "bonjour"}]}
    text = model_api.ocr_markdown("https://api.mistral.ai/v1", "k", "mistral-ocr-latest", "data:image/png;base64,AAA")
    assert text == "# Titre\nbonjour"
    assert FakeClient.sent["path"] == "/ocr"
    assert FakeClient.sent["json"] == {"model": "mistral-ocr-latest",
                                       "document": {"type": "image_url", "image_url": "data:image/png;base64,AAA"}}
    assert FakeClient.init["headers"]["Authorization"] == "Bearer k"


def test_ocr_markdown_wraps_http_errors_as_model_api_errors():
    import httpx
    request = httpx.Request("POST", "https://api.mistral.ai/v1/ocr")
    FakeClient.status_error = httpx.HTTPStatusError("bad", request=request, response=httpx.Response(401, request=request))
    with pytest.raises(ModelAPIError) as e:
        model_api.ocr_markdown("https://api.mistral.ai/v1", "k", "m", "data:image/png;base64,AAA")
    assert e.value.kind == ModelAPIError.KIND_AUTH


def _engine(monkeypatch, markdown):
    monkeypatch.setattr(ocr_module, "ocr_markdown", lambda **kw: markdown)
    return MistralOcrEngine(API)


def test_markdown_lines_become_blocks_without_confidence_or_fake_boxes(monkeypatch):
    blocks = _engine(monkeypatch, "# Leçon 1\n\nbonjour - hello\nmerci - thanks").ocr(IMG, "fra", (80, 40))
    assert [b.text for b in blocks] == ["# Leçon 1", "bonjour - hello", "merci - thanks"]
    assert all(b.words == [] and b.bbox == (0, 0, 80, 40) for b in blocks)


def test_markdown_table_separator_rows_are_dropped_but_cells_are_kept(monkeypatch):
    blocks = _engine(monkeypatch, "| mot | sens |\n| --- | --- |\n| chat | cat |").ocr(IMG, "fra", (80, 40))
    assert [b.text for b in blocks] == ["| mot | sens |", "| chat | cat |"]


@pytest.mark.parametrize("markdown", ["", "  \n\n "])
def test_empty_ocr_result_is_no_blocks(monkeypatch, markdown):
    assert _engine(monkeypatch, markdown).ocr(IMG, "fra", (80, 40)) == []


def test_the_request_carries_the_page_as_a_png_data_url(monkeypatch):
    seen = {}
    monkeypatch.setattr(ocr_module, "ocr_markdown", lambda **kw: seen.update(kw) or "x")
    MistralOcrEngine(API).ocr(IMG, "fra", (80, 40))
    assert seen["data_url"].startswith("data:image/png;base64,") and seen["model"] == "mistral-ocr-latest"


def test_engine_factory_picks_the_engine_for_the_endpoint_format():
    assert isinstance(remote_engine_for(API), MistralOcrEngine)
    assert isinstance(remote_engine_for({**API, "api_format": "openai", "model": "gpt-4o"}), RemoteOcrEngine)
    with pytest.raises(ParseError):
        remote_engine_for({**API, "api_format": "elevenlabs"})


def test_cache_id_names_the_endpoint_and_model_but_never_the_key():
    assert MistralOcrEngine(API).cache_id == "https://api.mistral.ai/v1|mistral-ocr-latest"


def test_probe_reads_the_known_word(monkeypatch):
    monkeypatch.setattr(model_api, "ocr_markdown", lambda **kw: "# FLUENCE")
    assert model_api.probe_ocr_api("https://api.mistral.ai/v1", "k", "mistral-ocr-latest") == "reads_images"
    monkeypatch.setattr(model_api, "ocr_markdown", lambda **kw: "")
    assert model_api.probe_ocr_api("https://api.mistral.ai/v1", "k", "mistral-ocr-latest") == "no_vision"


def test_probe_reports_unreachable_on_api_errors(monkeypatch):
    def boom(**kw):
        raise ModelAPIError(ModelAPIError.KIND_AUTH, 401, "bad key")
    monkeypatch.setattr(model_api, "ocr_markdown", boom)
    assert model_api.probe_ocr_api("https://api.mistral.ai/v1", "k", "m") == "unreachable"


def test_settings_know_the_mistral_ocr_provider_and_format():
    assert PROVIDERS["mistral_ocr"]["api_format"] == "mistral_ocr"
    ep = ApiEndpoint(provider="mistral_ocr", api_format="mistral_ocr", api_type="ocr")
    assert (ep.provider, ep.api_format) == ("mistral_ocr", "mistral_ocr")
