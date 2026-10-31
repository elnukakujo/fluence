import json

import pytest

from lapp.services.ingestion import classify as classify_module
from lapp.services.ingestion.classify import classify_pages, validate_page_kinds
from lapp.services.ingestion.types import ALL_KINDS
from lapp.utils.model_api import ModelAPIError
from lapp.services.parsing.types import Block, Document, Page, Word

API = {"base_url": "https://x/v1", "api_key": "k", "model": "m", "api_format": "openai", "auth_type": "bearer"}


def _doc(texts: dict[int, str]):
    pages = []
    for number, text in sorted(texts.items()):
        words = [Word(text=w, bbox=(0, 0, 1, 1)) for w in text.split()]
        pages.append(Page(index=number - 1, width=1, height=1, source="native", trust="native",
                          blocks=[Block(text=text, bbox=(0, 0, 10, 10), words=words)]))
    return Document(sha256="x", pipeline_version="1", pages=pages)


def _stub(monkeypatch, replies):
    queue = list(replies)

    def fake(**kw):
        r = queue.pop(0) if queue else "[]"
        if isinstance(r, Exception):
            raise r
        return r if isinstance(r, str) else json.dumps(r)

    monkeypatch.setattr(classify_module, "chat_completion", fake)


def _classify(doc):
    return classify_pages(doc, API, "French")


def test_returns_kinds_per_page(monkeypatch):
    _stub(monkeypatch, [[{"page": 1, "kinds": ["vocabulary"]}, {"page": 2, "kinds": ["grammar", "calligraphy"]},
                         {"page": 3, "kinds": []}]])
    assert _classify(_doc({1: "a", 2: "b", 3: "c"})) == {1: ["vocabulary"], 2: ["grammar", "calligraphy"], 3: []}


def test_unreadable_reply_means_all_kinds(monkeypatch):
    _stub(monkeypatch, ["nope", "nope"])
    assert _classify(_doc({1: "a", 2: "b"})) == {1: list(ALL_KINDS), 2: list(ALL_KINDS)}


def test_unknown_kind_dropped_and_missing_page_gets_all(monkeypatch):
    _stub(monkeypatch, [[{"page": 1, "kinds": ["wizard", "grammar"]}]])
    assert _classify(_doc({1: "a", 2: "b"})) == {1: ["grammar"], 2: list(ALL_KINDS)}


def test_auth_error_propagates(monkeypatch):
    _stub(monkeypatch, [ModelAPIError(ModelAPIError.KIND_AUTH, 401, "bad key")])
    with pytest.raises(ModelAPIError):
        _classify(_doc({1: "a"}))


def test_only_unknown_kinds_means_all_kinds_but_empty_stays_empty(monkeypatch):
    _stub(monkeypatch, [[{"page": 1, "kinds": ["wizard"]}, {"page": 2, "kinds": []}]])
    assert _classify(_doc({1: "a", 2: "b"})) == {1: list(ALL_KINDS), 2: []}


def test_retry_after_an_unreadable_reply(monkeypatch):
    _stub(monkeypatch, ["nope", [{"page": 1, "kinds": ["grammar"]}]])
    assert _classify(_doc({1: "a"})) == {1: ["grammar"]}


def test_non_abort_api_error_means_all_kinds(monkeypatch):
    _stub(monkeypatch, [ModelAPIError(ModelAPIError.KIND_SERVER, 500, "boom")])
    assert _classify(_doc({1: "a", 2: "b"})) == {1: list(ALL_KINDS), 2: list(ALL_KINDS)}


def test_validate_page_kinds_accepts_and_defaults():
    ok, err = validate_page_kinds({"1": ["grammar"], "2": []}, 1, 3, stored={"3": ["calligraphy"]})
    assert err is None and ok == {1: ["grammar"], 2: [], 3: ["calligraphy"]}
    ok, err = validate_page_kinds({}, 1, 2)
    assert ok == {1: list(ALL_KINDS), 2: list(ALL_KINDS)}


def test_validate_page_kinds_silently_filters_legacy_kinds():
    """Legacy passage/character kinds are silently filtered out."""
    ok, err = validate_page_kinds({"1": ["grammar", "passage"], "2": ["character", "exercise"]}, 1, 2)
    assert err is None and ok == {1: ["grammar"], 2: ["exercise"]}


@pytest.mark.parametrize("raw", [None, [], {"x": ["grammar"]}, {"9": ["grammar"]}, {"0": []}, {"1": ["wizard"]},
                                 {"1": "grammar"}, {"1": [True]}, {"1": [1]}])
def test_validate_page_kinds_rejects(raw):
    ok, err = validate_page_kinds(raw, 1, 3)
    assert ok is None and err
