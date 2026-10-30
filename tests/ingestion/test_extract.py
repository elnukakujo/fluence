import json

import pytest

from lapp.services.ingestion import extract as extract_module
from lapp.services.ingestion.extract import ExtractionError, extract_chunk
from lapp.services.ingestion.types import Chunk
from lapp.utils.model_api import ModelAPIError

API = {"base_url": "https://x/v1", "api_key": "k", "model": "deepseek-chat", "api_format": "openai", "auth_type": "bearer"}
CHUNK = Chunk(id="p0c0", page=0, text="苹果 apple\n房子 house", trust="native")
ITEM = {"word": "苹果", "translation": "apple", "phonetic": "píngguǒ", "word_type": "noun", "quote": "苹果 apple"}


def _stub(monkeypatch, *replies):
    calls = []
    queue = list(replies)

    def fake(**kw):
        calls.append(kw)
        reply = queue.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply

    monkeypatch.setattr(extract_module, "chat_completion", fake)
    return calls


def _run():
    return extract_chunk(CHUNK, API, "Chinese", "English")


def test_valid_array(monkeypatch):
    _stub(monkeypatch, json.dumps([ITEM]))
    items = _run()
    assert [(i.word, i.translation, i.quote) for i in items] == [("苹果", "apple", "苹果 apple")]


def test_markdown_fences_and_surrounding_prose_are_tolerated(monkeypatch):
    _stub(monkeypatch, "Here you go:\n```json\n" + json.dumps([ITEM]) + "\n```\nHope that helps!")
    assert [i.word for i in _run()] == ["苹果"]


def test_a_single_object_is_one_item(monkeypatch):
    _stub(monkeypatch, json.dumps(ITEM))
    assert [i.word for i in _run()] == ["苹果"]


def test_malformed_then_valid_retries_once(monkeypatch):
    calls = _stub(monkeypatch, "not json at all", json.dumps([ITEM]))
    assert [i.word for i in _run()] == ["苹果"] and len(calls) == 2


def test_malformed_twice_raises(monkeypatch):
    calls = _stub(monkeypatch, "nope", "still nope")
    with pytest.raises(ExtractionError):
        _run()
    assert len(calls) == 2


def test_model_api_error_propagates_without_retry(monkeypatch):
    calls = _stub(monkeypatch, ModelAPIError(ModelAPIError.KIND_AUTH, 401, "bad key"))
    with pytest.raises(ModelAPIError):
        _run()
    assert len(calls) == 1


def test_empty_array_is_no_items(monkeypatch):
    _stub(monkeypatch, "[]")
    assert _run() == []


def test_items_missing_word_or_quote_are_dropped(monkeypatch):
    bad = [{"translation": "x", "quote": "q"}, {"word": "房子"}, {"word": "", "quote": "q"}, "junk", ITEM]
    _stub(monkeypatch, json.dumps(bad))
    assert [i.word for i in _run()] == ["苹果"]


def test_blank_optional_fields_become_none(monkeypatch):
    _stub(monkeypatch, json.dumps([{**ITEM, "translation": "  ", "phonetic": "", "word_type": None}]))
    item = _run()[0]
    assert (item.translation, item.phonetic, item.word_type) == (None, None, None)


def test_request_is_deterministic_and_forbids_invention(monkeypatch):
    calls = _stub(monkeypatch, "[]")
    _run()
    kw = calls[0]
    assert kw["temperature"] == 0 and kw["model"] == "deepseek-chat" and kw["api_format"] == "openai"
    system = kw["messages"][0]["content"].lower()
    assert "verbatim" in system and "invent nothing" in system and "chinese" in system
    assert CHUNK.text in kw["messages"][1]["content"]
