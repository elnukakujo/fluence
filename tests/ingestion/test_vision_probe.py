import base64
import io

import pytest
from PIL import Image

from lapp.utils import model_api
from lapp.utils.model_api import ModelAPIError, probe_vision


def _stub(monkeypatch, reply=None, error=None):
    calls = []

    def fake(**kw):
        calls.append(kw)
        if error:
            raise error
        return reply

    monkeypatch.setattr(model_api, "chat_completion", fake)
    return calls


def _probe():
    return probe_vision("https://x/v1", "k", "m")


@pytest.mark.parametrize("reply", ["FLUENCE", "The text says Fluence.", "f l u e n c e"])
def test_model_that_reads_the_word_reads_images(monkeypatch, reply):
    _stub(monkeypatch, reply=reply)
    assert _probe() == "reads_images"


def test_model_that_cannot_see_the_image_is_no_vision(monkeypatch):
    _stub(monkeypatch, reply="I don't see any image attached.")
    assert _probe() == "no_vision"


@pytest.mark.parametrize("kind", [ModelAPIError.KIND_CONNECT, ModelAPIError.KIND_AUTH,
                                  ModelAPIError.KIND_NOT_FOUND, ModelAPIError.KIND_SERVER])
def test_transport_and_auth_errors_are_unreachable(monkeypatch, kind):
    _stub(monkeypatch, error=ModelAPIError(kind, 500, "boom"))
    assert _probe() == "unreachable"


def test_client_error_about_images_is_no_vision(monkeypatch):
    _stub(monkeypatch, error=ModelAPIError(ModelAPIError.KIND_CLIENT, 400,
                                           "Client error (400): image_url content is not supported"))
    assert _probe() == "no_vision"


def test_other_client_error_is_unreachable(monkeypatch):
    _stub(monkeypatch, error=ModelAPIError(ModelAPIError.KIND_CLIENT, 400, "Client error (400): model not found"))
    assert _probe() == "unreachable"


def test_request_carries_a_png_data_url_and_uses_openai_format(monkeypatch):
    calls = _stub(monkeypatch, reply="FLUENCE")
    _probe()
    kw = calls[0]
    assert kw["api_format"] == "openai" and kw["temperature"] == 0
    part = next(p for p in kw["messages"][-1]["content"] if p["type"] == "image_url")
    prefix = "data:image/png;base64,"
    assert part["image_url"]["url"].startswith(prefix)
    img = Image.open(io.BytesIO(base64.b64decode(part["image_url"]["url"][len(prefix):])))
    assert img.size[0] > 100
