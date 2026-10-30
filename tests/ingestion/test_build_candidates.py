import pytest

from lapp.services.ingestion import pipeline as pipeline_module
from lapp.services.ingestion.extract import ExtractionError, RawItem
from lapp.services.ingestion.pipeline import build_candidates
from lapp.services.parsing.types import Block, Document, Page, Word
from lapp.utils.model_api import ModelAPIError

API = {"base_url": "https://x/v1", "api_key": "k", "model": "m", "api_format": "openai", "auth_type": "bearer"}


def _page(index, text):
    words = [Word(text=w, bbox=(0, 0, 1, 1)) for w in text.split()]
    blocks = [Block(text=text, bbox=(0, 0, 100, 10), words=words)] if text else []
    return Page(index=index, width=600, height=800, source="native", trust="native", blocks=blocks)


def _doc(*texts):
    return Document(sha256="x", pipeline_version="1", pages=[_page(i, t) for i, t in enumerate(texts)])


def _build(doc, extractor, **kw):
    return build_candidates(doc, API, "fra", "eng", kw.pop("lookup", lambda w: None), **kw)


def _patch(monkeypatch, fn):
    calls = []

    def fake(chunk, api, target, source):
        calls.append(chunk.id)
        return fn(chunk)

    monkeypatch.setattr(pipeline_module, "extract_chunk", fake)
    return calls


def test_pages_without_text_spend_no_llm_call(monkeypatch):
    calls = _patch(monkeypatch, lambda c: [])
    result = _build(_doc("", "bonjour hello", ""), None)
    assert calls == ["p1c0"] and result.candidates == []


def test_candidates_are_verified_against_their_own_chunk(monkeypatch):
    _patch(monkeypatch, lambda c: [RawItem(word="bonjour", quote="bonjour hello", translation="hello")])
    result = _build(_doc("bonjour hello"), None)
    assert [(c.word, c.status, c.page) for c in result.candidates] == [("bonjour", "verified", 0)]


def test_an_invented_word_is_listed_and_flagged(monkeypatch):
    _patch(monkeypatch, lambda c: [RawItem(word="chat", quote="le chat")])
    cand = _build(_doc("bonjour hello"), None).candidates[0]
    assert cand.status == "flagged" and "word_not_in_source" in {f.code for f in cand.flags}


def test_a_failing_chunk_adds_a_warning_and_others_continue(monkeypatch):
    def fn(chunk):
        if chunk.page == 0:
            raise ExtractionError("bad json")
        return [RawItem(word="merci", quote="merci thanks")]
    _patch(monkeypatch, fn)
    result = _build(_doc("bonjour hello", "merci thanks"), None)
    assert [c.word for c in result.candidates] == ["merci"] and len(result.warnings) == 1
    assert "page 1" in result.warnings[0]


def test_transient_api_error_skips_the_chunk(monkeypatch):
    def fn(chunk):
        if chunk.page == 0:
            raise ModelAPIError(ModelAPIError.KIND_SERVER, 500, "oops")
        return []
    _patch(monkeypatch, fn)
    assert len(_build(_doc("bonjour hello", "merci thanks"), None).warnings) == 1


@pytest.mark.parametrize("kind", [ModelAPIError.KIND_AUTH, ModelAPIError.KIND_NOT_FOUND])
def test_config_errors_abort_instead_of_failing_every_chunk(monkeypatch, kind):
    calls = _patch(monkeypatch, lambda c: (_ for _ in ()).throw(ModelAPIError(kind, 401, "bad key")))
    with pytest.raises(ModelAPIError):
        _build(_doc("bonjour hello", "merci thanks"), None)
    assert len(calls) == 1


def test_every_chunk_failing_raises(monkeypatch):
    _patch(monkeypatch, lambda c: (_ for _ in ()).throw(ExtractionError("bad")))
    with pytest.raises(ExtractionError):
        _build(_doc("a b", "c d"), None)


def test_document_without_any_text_warns_and_is_empty(monkeypatch):
    calls = _patch(monkeypatch, lambda c: [])
    result = _build(_doc("", ""), None)
    assert calls == [] and result.candidates == [] and result.warnings


def test_progress_is_reported_per_chunk(monkeypatch):
    _patch(monkeypatch, lambda c: [])
    seen = []
    _build(_doc("a b", "c d"), None, progress=lambda done, total: seen.append((done, total)))
    assert seen == [(1, 2), (2, 2)]


def test_lookup_callback_annotates_known_words(monkeypatch):
    _patch(monkeypatch, lambda c: [RawItem(word="bonjour", quote="bonjour hello")])
    cand = _build(_doc("bonjour hello"), None, lookup=lambda w: "language" if w == "bonjour" else None).candidates[0]
    assert {f.code for f in cand.flags} == {"already_in_language"} and cand.status == "verified"
