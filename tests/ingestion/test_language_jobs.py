import json

import pytest

from ingestion_seeds import make_language, make_user
from lapp.services.ingestion import jobs as jobs_module
from lapp.services.ingestion import pipeline as pipeline_module
from lapp.services.ingestion import structure as structure_module
from lapp.services.ingestion.extract import ExtractionError, RawItem
from lapp.services.ingestion.jobs import (IngestionJobService, candidates_path, document_path,
                                          run_ingestion_job, run_language_extraction)
from lapp.services.parsing.types import Block, Document, Page, Word
from lapp.utils.model_api import ModelAPIError

svc = IngestionJobService()


def _doc():
    pages = []
    for n, text in enumerate(["Leçon 1 Salutations", "bonjour - hello", "Leçon 2 Merci", "merci - thanks"], start=1):
        words = [Word(text=w, bbox=(0, 0, 1, 1)) for w in text.split()]
        pages.append(Page(index=n - 1, width=1, height=1, source="native", trust="native",
                          blocks=[Block(text=text, bbox=(0, 0, 10, 10), words=words)]))
    return Document(sha256="x", pipeline_version="1", pages=pages)


@pytest.fixture()
def job(app, db, media_root):
    make_user(db, "user_U1")
    make_language(db, "user_U1")
    return svc.create("user_U1", "lang_L1", None, "book.pdf")      # no lesson: language mode


def _status(job_id):
    return svc.get(job_id)


def _patch_proposal(monkeypatch, reply):
    monkeypatch.setattr(jobs_module, "parse", lambda *a, **k: _doc())
    monkeypatch.setattr(structure_module, "chat_completion", lambda **kw: json.dumps(reply))


def test_language_job_parses_proposes_a_structure_and_waits_for_the_user(app, job, media_root, monkeypatch):
    _patch_proposal(monkeypatch, [{"page": 1, "title": "Leçon 1 Salutations"}, {"page": 3, "title": "Leçon 2 Merci"}])
    run_ingestion_job(app, job["id"])
    j = _status(job["id"])
    assert j["status"] == "structure" and j["structure"]["confirmed"] is False
    assert [(l["title"], l["start_page"], l["end_page"], l["verified"]) for l in j["structure"]["lessons"]] == [
        ("Leçon 1 Salutations", 1, 2, True), ("Leçon 2 Merci", 3, 4, True)]
    assert (j["structure"]["first_page"], j["structure"]["last_page"]) == (1, 4)
    assert document_path(media_root, job["id"]).is_file()


def test_bad_key_while_proposing_fails_the_job(app, job, monkeypatch):
    monkeypatch.setattr(jobs_module, "parse", lambda *a, **k: _doc())

    def auth_fail(**kw):
        raise ModelAPIError(ModelAPIError.KIND_AUTH, 401, "Authentication failed (401)")
    monkeypatch.setattr(structure_module, "chat_completion", auth_fail)
    run_ingestion_job(app, job["id"])
    assert _status(job["id"])["status"] == "failed" and "Authentication" in _status(job["id"])["error"]


def _confirmed(job, media_root, lessons=None):
    lessons = lessons or [{"title": "Salutations", "start_page": 1, "end_page": 2},
                          {"title": "Merci", "start_page": 3, "end_page": 4}]
    document_path(media_root, job["id"]).parent.mkdir(parents=True, exist_ok=True)
    document_path(media_root, job["id"]).write_text(_doc().model_dump_json())
    structure = {"confirmed": True, "first_page": 1, "last_page": 4,
                 "lessons": [{**l, "index": i, "verified": True, "note": None, "status": "pending", "error": None,
                              "counts": None} for i, l in enumerate(lessons)]}
    svc.update(job["id"], status="extracting", structure=structure)


def _items_from_text(chunk):
    out = []
    for line in chunk.text.splitlines():
        if " - " in line:
            w, t = line.split(" - ")
            out.append(RawItem(word=w, translation=t, quote=line))
    return out


def test_extraction_runs_per_lesson_and_writes_each_result(app, job, media_root, monkeypatch):
    _confirmed(job, media_root)
    monkeypatch.setattr(pipeline_module, "extract_chunk", lambda chunk, *a: _items_from_text(chunk))
    run_language_extraction(app, job["id"])
    j = _status(job["id"])
    assert j["status"] == "ready" and [l["status"] for l in j["structure"]["lessons"]] == ["done", "done"]
    first = json.loads(candidates_path(media_root, job["id"], 0).read_text())
    second = json.loads(candidates_path(media_root, job["id"], 1).read_text())
    assert [c["word"] for c in first["candidates"]] == ["bonjour"] and [c["word"] for c in second["candidates"]] == ["merci"]
    assert j["structure"]["lessons"][0]["counts"] == {"total": 1, "verified": 1, "flagged": 0, "elements": 0}


def test_one_failing_lesson_does_not_stop_the_others(app, job, media_root, monkeypatch):
    _confirmed(job, media_root)

    def fn(chunk, *a):
        if chunk.page < 2:
            raise ExtractionError("bad json")
        return _items_from_text(chunk)
    monkeypatch.setattr(pipeline_module, "extract_chunk", fn)
    run_language_extraction(app, job["id"])
    j = _status(job["id"])
    assert j["status"] == "ready"
    assert [l["status"] for l in j["structure"]["lessons"]] == ["failed", "done"] and j["structure"]["lessons"][0]["error"]


def test_every_lesson_failing_fails_the_job(app, job, media_root, monkeypatch):
    _confirmed(job, media_root)
    monkeypatch.setattr(pipeline_module, "extract_chunk", lambda *a: (_ for _ in ()).throw(ExtractionError("bad")))
    run_language_extraction(app, job["id"])
    assert _status(job["id"])["status"] == "failed"


def test_a_bad_key_during_extraction_aborts_the_job(app, job, media_root, monkeypatch):
    _confirmed(job, media_root)
    monkeypatch.setattr(pipeline_module, "extract_chunk",
                        lambda *a: (_ for _ in ()).throw(ModelAPIError(ModelAPIError.KIND_AUTH, 401, "Authentication failed (401)")))
    run_language_extraction(app, job["id"])
    assert _status(job["id"])["status"] == "failed" and "Authentication" in _status(job["id"])["error"]


def test_only_the_pages_of_each_lesson_reach_the_extractor(app, job, media_root, monkeypatch):
    _confirmed(job, media_root, [{"title": "Only merci", "start_page": 3, "end_page": 4}])
    seen = []
    monkeypatch.setattr(pipeline_module, "extract_chunk", lambda chunk, *a: seen.append(chunk.page) or [])
    run_language_extraction(app, job["id"])
    assert seen == [2, 3]          # 0-based pages 3 and 4


def test_proposal_classifies_the_pages_and_stores_page_kinds(app, job, media_root, monkeypatch):
    _patch_proposal(monkeypatch, [{"page": 1, "title": "Leçon 1"}])
    monkeypatch.setattr(jobs_module, "classify_pages", lambda doc, api, name: {1: [], 2: ["vocabulary"], 3: ["grammar"], 4: ["passage"]})
    run_ingestion_job(app, job["id"])
    assert _status(job["id"])["page_kinds"] == {"1": [], "2": ["vocabulary"], "3": ["grammar"], "4": ["passage"]}


def test_extraction_uses_the_stored_kinds_and_writes_elements(app, job, media_root, monkeypatch):
    _confirmed(job, media_root)
    svc.update(job["id"], page_kinds={"1": [], "2": [], "3": [], "4": ["grammar"]})
    monkeypatch.setattr(pipeline_module, "extract_chunk", lambda *a: pytest.fail("vocabulary call"))
    monkeypatch.setattr(pipeline_module, "extract_kind", lambda kind, chunk, *a: [
        {"title": "merci", "explanation": "merci - thanks", "example_sentences": [], "quote": "merci"}]
        if chunk.page == 3 else [])
    run_language_extraction(app, job["id"])
    j = _status(job["id"])
    assert [l["counts"] for l in j["structure"]["lessons"]] == [
        {"total": 0, "verified": 0, "flagged": 0, "elements": 0}, {"total": 0, "verified": 0, "flagged": 0, "elements": 1}]
    second = json.loads(candidates_path(media_root, job["id"], 1).read_text())
    assert [e["kind"] for e in second["elements"]] == ["grammar"]
