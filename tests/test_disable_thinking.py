import httpx
import pytest

from lapp.utils import model_api


class _Resp:
    def raise_for_status(self):
        pass

    def json(self):
        return {"choices": [{"message": {"content": "ok"}}]}


@pytest.fixture()
def sent(monkeypatch):
    bodies = []

    class _Client:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            pass

        def post(self, url, json=None, **k):
            bodies.append(json)
            return _Resp()

    monkeypatch.setattr(httpx, "Client", _Client)
    return bodies


def _call(base_url, **kw):
    return model_api.chat_completion(base_url=base_url, api_key="k", model="m",
                                     messages=[{"role": "user", "content": "x"}], max_tokens=5, **kw)


def test_deepseek_gets_its_thinking_switch(sent):
    _call("https://api.deepseek.com/v1", disable_thinking=True)
    assert sent[0]["thinking"] == {"type": "disabled"}


def test_other_servers_never_get_it(sent):
    _call("https://api.openai.com/v1", disable_thinking=True)
    assert "thinking" not in sent[0]


def test_deepseek_is_untouched_without_the_flag(sent):
    _call("https://api.deepseek.com/v1")
    assert "thinking" not in sent[0]
