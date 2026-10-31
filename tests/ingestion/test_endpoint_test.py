import httpx
import pytest

from ingestion_seeds import client_for, make_user
from lapp.utils import model_api


class _Resp:
    def raise_for_status(self):
        pass

    def json(self):
        return {"data": [{"id": "mistral-ocr-latest"}, {"id": "pixtral-large"}]}


class _Client:
    def __init__(self, *a, **k):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *a):
        pass

    def get(self, *a, **k):
        return _Resp()


@pytest.fixture()
def post(app, db, monkeypatch):
    make_user(db, "user_U1")
    monkeypatch.setattr(httpx, "Client", _Client)
    monkeypatch.setattr(model_api, "probe_ocr_api", lambda *a, **k: "reads_images")
    c = client_for(app, "user_U1")
    return lambda **b: c.post("/api/pref/test-endpoint", json={
        "base_url": "https://api.mistral.ai/v1", "api_key": "k", "api_type": "ocr",
        "api_format": "mistral_ocr", **b}).get_json()


def test_ocr_test_without_a_model_connects_and_lists_models(post):
    res = post()
    assert res["ok"] and res["available_models"] == ["mistral-ocr-latest", "pixtral-large"]
    assert "vision" not in res


def test_ocr_test_with_a_model_also_probes_vision(post):
    res = post(model="mistral-ocr-latest")
    assert res["ok"] and res["vision"] == "reads_images" and res["available_models"]


def test_ocr_test_reports_an_unreachable_endpoint(post, monkeypatch):
    class _Boom(_Client):
        def get(self, *a, **k):
            raise httpx.ConnectError("refused")
    monkeypatch.setattr(httpx, "Client", _Boom)
    res = post()
    assert not res["ok"] and res["error"]
