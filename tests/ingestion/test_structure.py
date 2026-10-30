import json

import pytest

from lapp.services.ingestion import structure as structure_module
from lapp.services.ingestion.structure import propose_structure, validate_structure
from lapp.services.parsing.types import Block, Document, Page, Word
from lapp.utils.model_api import ModelAPIError

API = {"base_url": "https://x/v1", "api_key": "k", "model": "m", "api_format": "openai", "auth_type": "bearer"}


def _doc(texts: dict[int, str], first_index=0):
    """texts: 1-based page number -> page text."""
    pages = []
    for number, text in sorted(texts.items()):
        words = [Word(text=w, bbox=(0, 0, 1, 1)) for w in text.split()]
        blocks = [Block(text=text, bbox=(0, 0, 10, 10), words=words)] if text else []
        pages.append(Page(index=number - 1, width=1, height=1, source="native", trust="native", blocks=blocks))
    return Document(sha256="x", pipeline_version="1", pages=pages)


def _stub(monkeypatch, replies):
    calls, queue = [], list(replies)

    def fake(**kw):
        calls.append(kw["messages"])
        r = queue.pop(0) if queue else "[]"
        if isinstance(r, Exception):
            raise r
        return r if isinstance(r, str) else json.dumps(r)

    monkeypatch.setattr(structure_module, "chat_completion", fake)
    return calls


def _propose(doc):
    return propose_structure(doc, API, "French", "book.pdf")


def test_lessons_get_derived_end_pages_and_verified_titles(monkeypatch):
    doc = _doc({1: "Contents", 2: "Leçon 1 Bonjour", 3: "more", 4: "Leçon 2 Merci", 5: "end"})
    _stub(monkeypatch, [[{"page": 2, "title": "Leçon 1 Bonjour"}, {"page": 4, "title": "Leçon 2 Merci"}]])
    props, warnings = _propose(doc)
    assert [(p.title, p.start_page, p.end_page, p.verified) for p in props] == [
        ("Leçon 1 Bonjour", 2, 3, True), ("Leçon 2 Merci", 4, 5, True)]
    assert warnings == []


def test_a_title_that_is_not_on_its_start_page_is_kept_but_flagged(monkeypatch):
    doc = _doc({1: "Leçon 1 Bonjour", 2: "something else"})
    _stub(monkeypatch, [[{"page": 1, "title": "Leçon 1 Bonjour"}, {"page": 2, "title": "Leçon 9 Invented"}]])
    props, _ = _propose(doc)
    assert [p.verified for p in props] == [True, False]
    assert "not found" in props[1].note


def test_pages_are_sent_in_batches_with_their_own_numbers(monkeypatch):
    doc = _doc({n: f"page {n} text" for n in range(1, 101)})
    calls = _stub(monkeypatch, [[], [], []])
    _propose(doc)
    assert len(calls) == 3
    assert "[page 1]" in calls[0][1]["content"] and "[page 40]" in calls[0][1]["content"] and "[page 41]" not in calls[0][1]["content"]
    assert "[page 81]" in calls[2][1]["content"] and "[page 100]" in calls[2][1]["content"]


def test_results_from_all_batches_are_merged_sorted_and_deduplicated(monkeypatch):
    doc = _doc({n: ("Unit %d" % n if n in (3, 45, 90) else "text") for n in range(1, 101)})
    _stub(monkeypatch, [[{"page": 3, "title": "Unit 3"}], [{"page": 45, "title": "Unit 45"}, {"page": 45, "title": "dup"}],
                        [{"page": 90, "title": "Unit 90"}]])
    props, _ = _propose(doc)
    assert [(p.title, p.start_page, p.end_page) for p in props] == [
        ("Unit 3", 3, 44), ("Unit 45", 45, 89), ("Unit 90", 90, 100)]


def test_invalid_items_are_dropped(monkeypatch):
    doc = _doc({1: "Unit 1", 2: "text"})
    _stub(monkeypatch, [[{"page": 1, "title": "Unit 1"}, {"page": 99, "title": "Unit 99"}, {"page": 2, "title": "  "},
                         {"title": "no page"}, "junk", {"page": "x", "title": "bad"}]])
    props, _ = _propose(doc)
    assert [p.title for p in props] == ["Unit 1"]


def test_no_boundaries_falls_back_to_one_lesson_over_the_whole_document(monkeypatch):
    doc = _doc({1: "a", 2: "b", 3: "c"})
    _stub(monkeypatch, [[]])
    props, warnings = _propose(doc)
    assert [(p.title, p.start_page, p.end_page, p.verified) for p in props] == [("book", 1, 3, False)]
    assert props[0].note and warnings


def test_malformed_reply_is_retried_once_then_the_batch_is_skipped_with_a_warning(monkeypatch):
    doc = _doc({1: "Unit 1", 2: "x"})
    calls = _stub(monkeypatch, ["nope", "still nope"])
    props, warnings = _propose(doc)
    assert len(calls) == 2 and len(props) == 1 and props[0].note and any("pages 1-2" in w for w in warnings)


def test_a_bad_api_key_aborts(monkeypatch):
    _stub(monkeypatch, [ModelAPIError(ModelAPIError.KIND_AUTH, 401, "bad key")])
    with pytest.raises(ModelAPIError):
        _propose(_doc({1: "x"}))


def test_document_with_a_page_range_uses_document_page_numbers(monkeypatch):
    doc = _doc({40: "Unit 5", 41: "text"})
    calls = _stub(monkeypatch, [[{"page": 40, "title": "Unit 5"}]])
    props, _ = _propose(doc)
    assert "[page 40]" in calls[0][1]["content"] and (props[0].start_page, props[0].end_page) == (40, 41)


# ---- validate_structure ------------------------------------------------------

def _v(lessons, pages=(1, 20)):
    return validate_structure(lessons, *pages)


def test_valid_structure_is_sorted_and_trimmed():
    clean, err = _v([{"title": " B ", "start_page": 10, "end_page": 20}, {"title": "A", "start_page": 1, "end_page": 9}])
    assert err is None and [(c["title"], c["start_page"]) for c in clean] == [("A", 1), ("B", 10)]


@pytest.mark.parametrize("lessons", [
    [],
    [{"title": " ", "start_page": 1, "end_page": 2}],
    [{"title": "A", "start_page": 5, "end_page": 4}],
    [{"title": "A", "start_page": 0, "end_page": 4}],
    [{"title": "A", "start_page": 1, "end_page": 99}],
    [{"title": "A", "start_page": 1, "end_page": 10}, {"title": "B", "start_page": 10, "end_page": 12}],
    [{"title": "A", "start_page": "x", "end_page": 4}],
])
def test_invalid_structures_are_rejected_with_a_reason(lessons):
    clean, err = _v(lessons)
    assert clean is None and err


def test_gaps_between_lessons_are_allowed():
    clean, err = _v([{"title": "A", "start_page": 1, "end_page": 3}, {"title": "B", "start_page": 10, "end_page": 12}])
    assert err is None and len(clean) == 2
