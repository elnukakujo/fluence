import json

import pytest

from ingestion_seeds import OCR_ENDPOINT, TEXT_ENDPOINT, make_language, make_user
from lapp.models.system_data import IngestionJob
from lapp.services.ingestion import jobs as jobs_module
from lapp.services.ingestion import pipeline as pipeline_module
from lapp.services.ingestion.extract import RawItem
from lapp.services.ingestion.jobs import IngestionJobService, candidates_path, document_path, run_ingestion_job, run_language_extraction, safe_filename
from lapp.services.parsing.types import Block, Document, ParseError, Page, Word
from lapp.services.ingestion.types import ALL_KINDS
from lapp.utils.model_api import ModelAPIError

svc = IngestionJobService()


def _doc():
    words = [Word(text=w, bbox=(0, 0, 1, 1)) for w in "bonjour hello".split()]
    page = Page(index=0, width=600, height=800, source="native", trust="native",
                blocks=[Block(text="bonjour hello", bbox=(0, 0, 100, 10), words=words)])
    return Document(sha256="x", pipeline_version="1", pages=[page])


@pytest.fixture()
def job(app, db, media_root):
    make_user(db, "user_U1")
    make_language(db, "user_U1")
    return svc.create("user_U1", "lang_L1", "lesson_L1", "notes.pdf")


def _status(job_id):
    return svc.get(job_id)


def _run_all(app, job_id):
    """Parse + classify, then (as the confirm route does) extract with the stored kinds."""
    run_ingestion_job(app, job_id)
    if _status(job_id)["status"] == "pages":
        run_language_extraction(app, job_id)


def test_safe_filename_strips_directories_and_odd_characters():
    assert safe_filename("../../etc/passwd") == "passwd"
    assert safe_filename("my notes (1).PDF") == "my_notes_1_.PDF"
    assert safe_filename("") == "upload"
    assert len(safe_filename("a" * 300 + ".pdf")) <= 80 and safe_filename("a" * 300 + ".pdf").endswith(".pdf")


def test_create_persists_a_queued_job_with_a_path_inside_its_own_folder(job):
    assert job["status"] == "queued" and job["id"].startswith("ing_J")
    assert job["file_path"] == f"ingestion/{job['id']}/notes.pdf"


def test_job_stores_page_kinds(job):
    assert job["page_kinds"] is None
    svc.update(job["id"], page_kinds={"3": ["grammar"]})
    assert svc.get(job["id"])["page_kinds"] == {"3": ["grammar"]}


def test_create_accepts_source_fields_with_defaults_to_none(app, db, media_root):
    make_user(db, "user_U1")
    make_language(db, "user_U1")
    job1 = svc.create("user_U1", "lang_L1", "lesson_L1", "notes.pdf")
    assert job1["source_title"] is None and job1["source_type"] is None
    assert job1["source_description"] is None and job1["level"] is None
    job2 = svc.create("user_U1", "lang_L1", "lesson_L1", "notes.pdf",
                      source_title="HSK 2", source_type="textbook",
                      source_description="Manual", level=2)
    assert job2["source_title"] == "HSK 2" and job2["source_type"] == "textbook"
    assert job2["source_description"] == "Manual" and job2["level"] == 2
    fetched = svc.get(job2["id"])
    assert fetched["source_title"] == "HSK 2" and fetched["level"] == 2


def test_only_the_owner_can_get_or_delete_a_job(job, db):
    make_user(db, "user_U2")
    assert svc.get(job["id"], user_id="user_U2") is None
    assert svc.delete(job["id"], "user_U2") is False
    assert svc.get(job["id"], user_id="user_U1")["id"] == job["id"]
    assert svc.delete(job["id"], "user_U1") is True and svc.get(job["id"]) is None


def test_fail_interrupted_only_touches_running_jobs(job):
    svc.update(job["id"], status="extracting")
    other = svc.create("user_U1", "lang_L1", None, "b.pdf")
    assert svc.fail_interrupted() == 1
    assert _status(job["id"])["status"] == "failed" and "restart" in _status(job["id"])["error"]
    assert _status(other["id"])["status"] == "queued"


def test_successful_run_writes_candidates_and_marks_ready(app, job, media_root, monkeypatch):
    monkeypatch.setattr(jobs_module, "parse", lambda *a, **k: _doc())
    monkeypatch.setattr(pipeline_module, "extract_chunk",
                        lambda *a: [RawItem(word="bonjour", quote="bonjour hello", translation="hello"),
                                    RawItem(word="chat", quote="le chat")])
    _run_all(app, job["id"])
    j = _status(job["id"])
    assert (j["status"], j["pages_done"], j["pages_total"]) == ("ready", 1, 1)
    data = json.loads(candidates_path(media_root, job["id"]).read_text())
    by_word = {c["word"]: c for c in data["candidates"]}
    assert by_word["bonjour"]["status"] == "verified"
    assert by_word["chat"]["status"] == "flagged"   # invented word is listed, flagged


def test_existing_words_are_annotated_by_where_they_exist(app, job, db, media_root, monkeypatch):
    from lapp.models.components import Word as WordModel
    from lapp.models.features import Vocabulary
    with db.session_scope() as s:
        db.insert(WordModel(id="word_W1", language_id="lang_L1", word="bonjour"), session=s, commit=False)
        db.insert(WordModel(id="word_W2", language_id="lang_L1", word="hello"), session=s, commit=False)
        db.insert(Vocabulary(id="voc_V1", lesson_id="lesson_L1", word_id="word_W2"), session=s, commit=False)
    monkeypatch.setattr(jobs_module, "parse", lambda *a, **k: _doc())
    monkeypatch.setattr(pipeline_module, "extract_chunk", lambda *a: [
        RawItem(word="bonjour", quote="bonjour hello"), RawItem(word="hello", quote="bonjour hello")])
    _run_all(app, job["id"])
    cands = {c["word"]: c for c in json.loads(candidates_path(media_root, job["id"]).read_text())["candidates"]}
    assert [f["code"] for f in cands["bonjour"]["flags"]] == ["already_in_language"] and cands["bonjour"]["status"] == "verified"
    assert [f["code"] for f in cands["hello"]["flags"]] == ["already_in_lesson"] and cands["hello"]["status"] == "flagged"


def test_parse_error_fails_the_job_with_its_code(app, job, monkeypatch):
    def boom(*a, **k):
        raise ParseError("encrypted", "The PDF is password-protected")
    monkeypatch.setattr(jobs_module, "parse", boom)
    run_ingestion_job(app, job["id"])
    assert _status(job["id"])["status"] == "failed" and "encrypted" in _status(job["id"])["error"]


def test_missing_text_endpoint_fails_early_without_parsing(app, db, media_root, monkeypatch):
    make_user(db, "user_U3", endpoints=())
    make_language(db, "user_U3", "lang_L3", "lesson_L3")
    j = svc.create("user_U3", "lang_L3", None, "n.pdf")
    monkeypatch.setattr(jobs_module, "parse", lambda *a, **k: pytest.fail("parsed"))
    run_ingestion_job(app, j["id"])
    assert "text-generation endpoint" in _status(j["id"])["error"]


def test_bad_api_key_fails_the_job_once(app, job, monkeypatch):
    monkeypatch.setattr(jobs_module, "parse", lambda *a, **k: _doc())
    calls = []

    def auth_fail(*a):
        calls.append(1)
        raise ModelAPIError(ModelAPIError.KIND_AUTH, 401, "Authentication failed (401)")
    monkeypatch.setattr(pipeline_module, "extract_chunk", auth_fail)
    _run_all(app, job["id"])
    assert _status(job["id"])["status"] == "failed" and "Authentication" in _status(job["id"])["error"]


def test_unexpected_crash_is_a_failed_job_not_an_exception(app, job, monkeypatch):
    monkeypatch.setattr(jobs_module, "parse", lambda *a, **k: 1 / 0)
    run_ingestion_job(app, job["id"])   # must not raise
    assert _status(job["id"])["status"] == "failed" and "Unexpected" in _status(job["id"])["error"]


def test_user_ocr_endpoint_becomes_the_remote_engine(app, db, media_root, monkeypatch):
    make_user(db, "user_U4", endpoints=(TEXT_ENDPOINT, OCR_ENDPOINT))
    make_language(db, "user_U4", "lang_L4", "lesson_L4")
    j = svc.create("user_U4", "lang_L4", None, "n.pdf", handwritten=True)
    seen = {}

    def fake_parse(path, **kw):
        seen.update(kw)
        return _doc()
    monkeypatch.setattr(jobs_module, "parse", fake_parse)
    monkeypatch.setattr(pipeline_module, "extract_chunk", lambda *a: [])
    run_ingestion_job(app, j["id"])
    assert seen["remote"] is not None and seen["handwritten"] is True
    assert seen["target_iso639_2t"] == "fra" and seen["cache_dir"].name == "parse_cache"


def test_runner_passes_the_page_range_to_the_parser(app, db, media_root, monkeypatch):
    make_user(db, "user_U5")
    make_language(db, "user_U5", "lang_L5", "lesson_L5")
    j = svc.create("user_U5", "lang_L5", None, "n.pdf", page_from=3, page_to=9)
    seen = {}
    monkeypatch.setattr(jobs_module, "parse", lambda path, **kw: seen.update(kw) or _doc())
    monkeypatch.setattr(pipeline_module, "extract_chunk", lambda *a: [])
    run_ingestion_job(app, j["id"])
    assert seen["pages"] == (3, 9)


def test_runner_without_a_range_parses_everything(app, job, media_root, monkeypatch):
    seen = {}
    monkeypatch.setattr(jobs_module, "parse", lambda path, **kw: seen.update(kw) or _doc())
    monkeypatch.setattr(pipeline_module, "extract_chunk", lambda *a: [])
    run_ingestion_job(app, job["id"])
    assert seen["pages"] is None


def _patch_run(monkeypatch, kinds, grammar=None):
    monkeypatch.setattr(jobs_module, "parse", lambda *a, **k: _doc())
    monkeypatch.setattr(jobs_module, "classify_pages", lambda doc, api, name: kinds)
    monkeypatch.setattr(pipeline_module, "extract_chunk", lambda *a: [])


def test_lesson_import_stops_at_pages_status(app, job, media_root, monkeypatch):
    _patch_run(monkeypatch, {1: ["vocabulary", "grammar"]})
    run_ingestion_job(app, job["id"])
    j = _status(job["id"])
    assert j["status"] == "pages" and j["page_kinds"] == {"1": ["vocabulary", "grammar"]}
    assert document_path(media_root, job["id"]).is_file() and not candidates_path(media_root, job["id"]).exists()


def test_failed_classification_step_gives_every_kind(app, job, monkeypatch):
    _patch_run(monkeypatch, None)
    monkeypatch.setattr(jobs_module, "classify_pages",
                        lambda *a: (_ for _ in ()).throw(ModelAPIError(ModelAPIError.KIND_SERVER, 500, "boom")))
    run_ingestion_job(app, job["id"])
    assert _status(job["id"])["status"] == "pages" and _status(job["id"])["page_kinds"] == {"1": list(ALL_KINDS)}


def test_bad_key_while_classifying_fails_the_job(app, job, monkeypatch):
    _patch_run(monkeypatch, None)
    monkeypatch.setattr(jobs_module, "classify_pages",
                        lambda *a: (_ for _ in ()).throw(ModelAPIError(ModelAPIError.KIND_AUTH, 401, "Authentication failed (401)")))
    run_ingestion_job(app, job["id"])
    assert _status(job["id"])["status"] == "failed"


def test_confirmed_kinds_drive_extraction_and_elements_are_written(app, job, media_root, monkeypatch):
    _patch_run(monkeypatch, {1: ["vocabulary"]})
    run_ingestion_job(app, job["id"])
    svc.update(job["id"], page_kinds={"1": ["grammar"]}, status="extracting")
    seen = []
    from lapp.services.ingestion.types import ElementCandidate

    def mock_generate_grammar(chunk, api, target, source):
        seen.append("grammar")
        return [{"title": "bonjour", "explanation": "bonjour hello", "example_sentences": [], "quote": "bonjour"}]

    monkeypatch.setattr(pipeline_module, "generate_grammar", mock_generate_grammar)
    run_language_extraction(app, job["id"])
    data = json.loads(candidates_path(media_root, job["id"]).read_text())
    assert seen == ["grammar"] and data["candidates"] == [] and [e["kind"] for e in data["elements"]] == ["grammar"]
    assert _status(job["id"])["status"] == "ready"


def test_legacy_job_without_page_kinds_runs_vocabulary_only(app, job, media_root, monkeypatch):
    _patch_run(monkeypatch, {1: ["vocabulary"]})
    run_ingestion_job(app, job["id"])
    svc.update(job["id"], page_kinds=None, status="extracting")
    monkeypatch.setattr(pipeline_module, "extract_kind", lambda *a: pytest.fail("element call"))
    run_language_extraction(app, job["id"])
    assert json.loads(candidates_path(media_root, job["id"]).read_text())["elements"] == []


def test_attach_existing_shows_the_saved_word(monkeypatch):
    from types import SimpleNamespace as NS
    from lapp.services.ingestion import jobs
    from lapp.services.ingestion.types import Candidate, Flag
    cand = Candidate(id="1", word="水", quote="水", page=0, chunk_id="c", status="verified",
                     flags=[Flag(code="already_in_language", message="m", severity="info")])
    saved = NS(word="水", translation="water", phonetic="shuǐ", word_type="noun")
    monkeypatch.setattr("lapp.services.components.WordService.get_by_word", lambda self, w, language_id=None: saved)
    jobs._attach_existing({"language_id": "L1"}, NS(candidates=[cand], elements=[]))
    assert cand.existing == {"word": "水", "translation": "water", "phonetic": "shuǐ", "word_type": "noun"}
