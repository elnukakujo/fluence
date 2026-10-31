import pytest

import io
import json

from ingestion_seeds import client_for, make_language, make_user
from lapp.models.features import Vocabulary
from lapp.services import WordService
from lapp.services.ingestion.jobs import IngestionJobService, candidates_path

svc = IngestionJobService()


def _upload(client, filename="notes.pdf", data=b"%PDF-1.4 fake", **form):
    form = {"language_id": "lang_L1", **form}
    return client.post("/api/ingestion", data={**form, "file": (io.BytesIO(data), filename)},
                       content_type="multipart/form-data")


def _setup(app, db, media_root):
    make_user(db, "user_U1")
    make_language(db, "user_U1")
    return client_for(app, "user_U1")


def test_upload_without_a_text_endpoint_is_a_clear_400(app, db, media_root, scheduled):
    make_user(db, "user_U1", endpoints=())
    make_language(db, "user_U1")
    res = _upload(client_for(app, "user_U1"))
    assert res.status_code == 400 and "text-generation endpoint" in res.get_json()["error"]
    assert scheduled == []


def test_upload_rejects_missing_file_and_unsupported_type(app, db, media_root, scheduled):
    client = _setup(app, db, media_root)
    assert client.post("/api/ingestion", data={"language_id": "lang_L1"}).status_code == 400
    assert _upload(client, "notes.exe").status_code == 400
    assert scheduled == []


def test_upload_saves_the_file_creates_a_job_and_schedules_it(app, db, media_root, scheduled):
    client = _setup(app, db, media_root)
    res = _upload(client, lesson_id="lesson_L1", handwritten="true")
    assert res.status_code == 202
    job_id = res.get_json()["job_id"]
    job = svc.get(job_id)
    assert job["status"] == "queued" and job["handwritten"] is True and scheduled == [job_id]
    assert (media_root / job["file_path"]).read_bytes() == b"%PDF-1.4 fake"


def test_upload_into_someone_elses_language_is_forbidden(app, db, media_root, scheduled):
    _setup(app, db, media_root)
    make_user(db, "user_U2")
    assert _upload(client_for(app, "user_U2")).status_code == 403
    assert scheduled == []


def test_lesson_of_another_language_is_rejected(app, db, media_root, scheduled):
    client = _setup(app, db, media_root)
    make_language(db, "user_U1", "lang_L2", "lesson_L2")
    assert _upload(client, lesson_id="lesson_L2").status_code == 400


def test_job_status_is_visible_to_the_owner_only(app, db, media_root, scheduled):
    client = _setup(app, db, media_root)
    job_id = _upload(client).get_json()["job_id"]
    body = client.get(f"/api/ingestion/{job_id}").get_json()
    assert body["status"] == "queued" and "file_path" not in body and "user_id" not in body
    make_user(db, "user_U2")
    other = client_for(app, "user_U2")
    for url in (f"/api/ingestion/{job_id}", f"/api/ingestion/{job_id}/candidates"):
        assert other.get(url).status_code == 404
    assert other.delete(f"/api/ingestion/{job_id}").status_code == 404


def test_candidates_are_409_until_ready(app, db, media_root, scheduled):
    client = _setup(app, db, media_root)
    job_id = _upload(client, lesson_id="lesson_L1").get_json()["job_id"]     # lesson-level job
    assert client.get(f"/api/ingestion/{job_id}/candidates").status_code == 409
    svc.update(job_id, status="ready")
    candidates_path(media_root, job_id).write_text(json.dumps({"candidates": [{"word": "a"}], "warnings": []}))
    res = client.get(f"/api/ingestion/{job_id}/candidates")
    assert res.status_code == 200 and res.get_json()["candidates"] == [{"word": "a"}]


def _ready_job(client):
    job_id = _upload(client).get_json()["job_id"]
    svc.update(job_id, status="ready")
    return job_id


def test_accept_creates_words_and_vocabulary_in_the_lesson(app, db, media_root, scheduled):
    client = _setup(app, db, media_root)
    job_id = _ready_job(client)
    res = client.post(f"/api/ingestion/{job_id}/accept", json={"lesson_id": "lesson_L1", "items": [
        {"word": "bonjour", "translation": "hello"}, {"word": "merci", "translation": "thanks", "word_type": "noun"}]})
    assert res.status_code == 200 and res.get_json()["created"] == 2
    word = WordService().get_by_word("bonjour", language_id="lang_L1")
    assert word is not None and word.translation == "hello"
    with db.session_scope() as s:
        assert s.query(Vocabulary).filter(Vocabulary.lesson_id == "lesson_L1").count() == 2


def test_accept_keeps_an_existing_word_by_default(app, db, media_root, scheduled):
    client = _setup(app, db, media_root)
    first = _ready_job(client)
    client.post(f"/api/ingestion/{first}/accept", json={"lesson_id": "lesson_L1", "items": [
        {"word": "bonjour", "translation": "hello"}]})
    second = _ready_job(client)
    res = client.post(f"/api/ingestion/{second}/accept", json={"lesson_id": "lesson_L1", "items": [
        {"word": "bonjour", "translation": "DIFFERENT"}]})
    assert res.status_code == 200
    assert WordService().get_by_word("bonjour", language_id="lang_L1").translation == "hello"


def test_accept_validates_input(app, db, media_root, scheduled):
    client = _setup(app, db, media_root)
    job_id = _ready_job(client)
    url = f"/api/ingestion/{job_id}/accept"
    assert client.post(url, json={"lesson_id": "lesson_L1", "items": []}).status_code == 400
    assert client.post(url, json={"lesson_id": "lesson_L1", "items": [{"word": " "}]}).status_code == 400
    assert client.post(url, json={"lesson_id": "lesson_L1",
                                  "items": [{"word": "a", "on_conflict": "explode"}]}).status_code == 400
    make_language(db, "user_U1", "lang_L2", "lesson_L2")
    assert client.post(url, json={"lesson_id": "lesson_L2", "items": [{"word": "a"}]}).status_code == 400


def test_accept_into_a_lesson_you_cannot_write_is_forbidden(app, db, media_root, scheduled):
    client = _setup(app, db, media_root)
    job_id = _ready_job(client)
    make_user(db, "user_U2")
    make_language(db, "user_U2", "lang_L9", "lesson_L9")
    res = client.post(f"/api/ingestion/{job_id}/accept", json={"lesson_id": "lesson_L9", "items": [{"word": "a"}]})
    assert res.status_code == 403


def test_delete_removes_the_row_and_the_files(app, db, media_root, scheduled):
    client = _setup(app, db, media_root)
    job_id = _upload(client).get_json()["job_id"]
    folder = media_root / "ingestion" / job_id
    assert folder.is_dir()
    assert client.delete(f"/api/ingestion/{job_id}").status_code == 204
    assert not folder.exists() and client.get(f"/api/ingestion/{job_id}").status_code == 404


def test_upload_stores_a_page_range(app, db, media_root, scheduled):
    client = _setup(app, db, media_root)
    job_id = _upload(client, page_from="40", page_to="55").get_json()["job_id"]
    job = svc.get(job_id)
    assert (job["page_from"], job["page_to"]) == (40, 55)


def test_upload_without_a_range_keeps_it_null(app, db, media_root, scheduled):
    client = _setup(app, db, media_root)
    job = svc.get(_upload(client).get_json()["job_id"])
    assert (job["page_from"], job["page_to"]) == (None, None)


def test_invalid_page_ranges_are_rejected(app, db, media_root, scheduled):
    client = _setup(app, db, media_root)
    for form in ({"page_from": "5"}, {"page_to": "5"}, {"page_from": "0", "page_to": "3"},
                 {"page_from": "9", "page_to": "3"}, {"page_from": "a", "page_to": "3"}):
        assert _upload(client, **form).status_code == 400, form
    assert scheduled == []


# ---- capabilities -----------------------------------------------------------

def _caps(client, **q):
    return client.get("/api/ingestion/capabilities", query_string={"language_id": "lang_L1", **q})


def _codes(items):
    return [i["code"] for i in items]


def test_capabilities_ok_with_a_text_endpoint_and_warns_about_vision(app, db, media_root):
    client = _setup(app, db, media_root)
    body = _caps(client, lesson_id="lesson_L1").get_json()
    assert body["can_import"] is True and body["reasons"] == []
    assert _codes(body["warnings"]) == ["no_vision_endpoint"]


def test_capabilities_blocks_without_a_text_endpoint_and_explains_where_to_fix_it(app, db, media_root):
    make_user(db, "user_U1", endpoints=())
    make_language(db, "user_U1")
    body = _caps(client_for(app, "user_U1")).get_json()
    assert body["can_import"] is False and _codes(body["reasons"]) == ["no_text_endpoint"]
    assert "Settings" in body["reasons"][0]["message"]


def test_capabilities_blocks_without_write_access(app, db, media_root):
    _setup(app, db, media_root)
    make_user(db, "user_U2")
    body = _caps(client_for(app, "user_U2")).get_json()
    assert body["can_import"] is False and "no_write_access" in _codes(body["reasons"])


def test_capabilities_with_a_vision_endpoint_has_no_vision_warning(app, db, media_root):
    from ingestion_seeds import OCR_ENDPOINT, TEXT_ENDPOINT
    make_user(db, "user_U1", endpoints=(TEXT_ENDPOINT, OCR_ENDPOINT))
    make_language(db, "user_U1")
    assert _caps(client_for(app, "user_U1")).get_json()["warnings"] == []


def test_capabilities_warns_for_a_custom_language(app, db, media_root):
    from lapp.models.containers import Language
    make_user(db, "user_U1")
    with db.session_scope() as s:
        db.insert(Language(id="lang_L1", user_id="user_U1", name="Klingon", target_iso639_2t="",
                           source_iso639_2t="eng"), session=s, commit=False)
    body = _caps(client_for(app, "user_U1")).get_json()
    assert "custom_language" in _codes(body["warnings"]) and body["can_import"] is True


def test_capabilities_needs_a_known_language(app, db, media_root):
    client = _setup(app, db, media_root)
    assert client.get("/api/ingestion/capabilities").status_code == 400
    assert _caps(client, language_id="lang_nope").status_code == 404


# ---- imports list -----------------------------------------------------------

def test_list_returns_only_my_jobs_newest_first_without_internal_fields(app, db, media_root, scheduled):
    client = _setup(app, db, media_root)
    a = _upload(client, "a.pdf").get_json()["job_id"]
    b = _upload(client, "b.pdf").get_json()["job_id"]
    make_user(db, "user_U2")
    make_language(db, "user_U2", "lang_L7", "lesson_L7")
    client_for(app, "user_U2").post("/api/ingestion", data={"language_id": "lang_L7",
                                    "file": (io.BytesIO(b"%PDF"), "other.pdf")}, content_type="multipart/form-data")
    jobs = client.get("/api/ingestion").get_json()
    assert [j["id"] for j in jobs] == [b, a]
    assert all("file_path" not in j and "user_id" not in j for j in jobs)
    assert jobs[0]["filename"] == "b.pdf"


# ---- page preview -----------------------------------------------------------

def _job_with_pdf(client, media_root, pages=2):
    import pymupdf
    job_id = _upload(client).get_json()["job_id"]
    doc = pymupdf.open()
    for i in range(pages):
        doc.new_page(width=300, height=400).insert_text((20, 50), f"page {i + 1}")
    doc.save(media_root / svc.get(job_id)["file_path"])
    return job_id


def test_page_preview_renders_a_png_for_the_owner(app, db, media_root, scheduled):
    client = _setup(app, db, media_root)
    job_id = _job_with_pdf(client, media_root)
    res = client.get(f"/api/ingestion/{job_id}/pages/2.png")
    assert res.status_code == 200 and res.mimetype == "image/png" and res.data.startswith(b"\x89PNG")
    assert "private" in res.headers["Cache-Control"]


def test_page_preview_rejects_out_of_range_and_other_users(app, db, media_root, scheduled):
    client = _setup(app, db, media_root)
    job_id = _job_with_pdf(client, media_root)
    assert client.get(f"/api/ingestion/{job_id}/pages/3.png").status_code == 404
    assert client.get(f"/api/ingestion/{job_id}/pages/0.png").status_code == 404
    make_user(db, "user_U2")
    assert client_for(app, "user_U2").get(f"/api/ingestion/{job_id}/pages/1.png").status_code == 404


def test_page_preview_of_an_uploaded_image(app, db, media_root, scheduled):
    from PIL import Image
    client = _setup(app, db, media_root)
    buf = io.BytesIO()
    Image.new("RGB", (200, 100), "white").save(buf, "PNG")
    job_id = _upload(client, "scan.png", buf.getvalue()).get_json()["job_id"]
    assert client.get(f"/api/ingestion/{job_id}/pages/1.png").status_code == 200
    assert client.get(f"/api/ingestion/{job_id}/pages/2.png").status_code == 404


# ---- source tagging ---------------------------------------------------------

def test_accept_tags_created_vocabulary_with_one_reused_source(app, db, media_root, scheduled):
    from lapp.models.system_data import Source
    client = _setup(app, db, media_root)
    for words in (["bonjour"], ["merci"]):
        job_id = _ready_job(client)
        client.post(f"/api/ingestion/{job_id}/accept", json={"lesson_id": "lesson_L1",
                                                             "items": [{"word": w} for w in words]})
    with db.session_scope() as s:
        sources = s.query(Source).filter(Source.user_id == "user_U1").all()
        assert [x.title for x in sources] == ["Imported from notes.pdf"]
        vocs = s.query(Vocabulary).filter(Vocabulary.lesson_id == "lesson_L1").all()
        assert len(vocs) == 2 and all([src.id for src in v.sources] == [sources[0].id] for v in vocs)


def _pages_job(client, kinds=None):
    job_id = _upload(client, lesson_id="lesson_L1").get_json()["job_id"]
    svc.update(job_id, status="pages", page_kinds=kinds or {"1": ["vocabulary"], "2": ["grammar"]})
    return job_id


def test_get_pages_returns_kinds_and_range(app, db, media_root, scheduled):
    client = _setup(app, db, media_root)
    body = client.get(f"/api/ingestion/{_pages_job(client)}/pages").get_json()
    assert body["status"] == "pages" and body["page_kinds"] == {"1": ["vocabulary"], "2": ["grammar"]}
    assert (body["first_page"], body["last_page"], body["warnings"]) == (1, 2, [])


def test_post_pages_starts_extraction_and_stores_the_kinds(app, db, media_root, scheduled, monkeypatch):
    client = _setup(app, db, media_root)
    job_id = _pages_job(client)
    started = []
    monkeypatch.setattr(app.scheduler, "schedule_extraction", lambda a, jid: started.append(jid))
    res = client.post(f"/api/ingestion/{job_id}/pages", json={"page_kinds": {"1": [], "2": ["grammar", "calligraphy"]}})
    assert res.status_code == 200 and started == [job_id]
    job = svc.get(job_id)
    assert job["status"] == "extracting" and job["page_kinds"] == {"1": [], "2": ["grammar", "calligraphy"]}


@pytest.mark.parametrize("kinds", [{"1": ["wizard"]}, {"9": ["grammar"]}, {"x": []}, None])
def test_post_pages_rejects_bad_input_without_changes(app, db, media_root, scheduled, monkeypatch, kinds):
    client = _setup(app, db, media_root)
    job_id = _pages_job(client)
    monkeypatch.setattr(app.scheduler, "schedule_extraction", lambda a, jid: pytest.fail("scheduled"))
    res = client.post(f"/api/ingestion/{job_id}/pages", json={"page_kinds": kinds})
    assert res.status_code == 400 and svc.get(job_id)["status"] == "pages"


def test_second_post_pages_is_409(app, db, media_root, scheduled, monkeypatch):
    client = _setup(app, db, media_root)
    job_id = _pages_job(client)
    monkeypatch.setattr(app.scheduler, "schedule_extraction", lambda a, jid: None)
    assert client.post(f"/api/ingestion/{job_id}/pages", json={"page_kinds": {}}).status_code == 200
    assert client.post(f"/api/ingestion/{job_id}/pages", json={"page_kinds": {}}).status_code == 409
    assert client.get(f"/api/ingestion/{job_id}/pages").status_code == 409


# ---- elements (grammar, calligraphy, exercise) --------------------------------

def test_accept_creates_grammar_calligraphy_exercise_with_source(app, db, media_root, scheduled):
    from lapp.models.features import Grammar, Calligraphy, Exercise
    from lapp.models.system_data import Source
    client = _setup(app, db, media_root)
    job_id = _ready_job(client)
    res = client.post(f"/api/ingestion/{job_id}/accept", json={
        "lesson_id": "lesson_L1",
        "items": [{"word": "hello"}],
        "elements": [
            {"kind": "grammar", "fields": {"title": "Present tense", "explanation": "Used for now", "example_sentences": []}},
            {"kind": "calligraphy", "fields": {"character": "中", "phonetic": "zhong", "meaning": "middle", "radical": None, "strokes": None}},
            {"kind": "exercise", "fields": {"exercise_type": "answering", "question": "What?", "answer": "Answer", "text_support": None, "content": None}}
        ]
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data["created"] == 1 and data["created_elements"] == 3

    with db.session_scope() as s:
        grammar = s.query(Grammar).filter(Grammar.lesson_id == "lesson_L1", Grammar.title == "Present tense").first()
        assert grammar and grammar.explanation == "Used for now"
        calligraphy = s.query(Calligraphy).filter(Calligraphy.lesson_id == "lesson_L1").first()
        assert calligraphy and calligraphy.character.character == "中"
        exercise = s.query(Exercise).filter(Exercise.lesson_id == "lesson_L1", Exercise.question == "What?").first()
        assert exercise and exercise.answer == "Answer"
        # Check all are tagged with import source
        source = s.query(Source).filter(Source.user_id == "user_U1", Source.title.like("Imported from%")).first()
        assert source
        assert any(src.id == source.id for src in grammar.sources)
        assert any(src.id == source.id for src in calligraphy.sources)
        assert any(src.id == source.id for src in exercise.sources)


def test_accept_grammar_creates_nested_passages_for_examples(app, db, media_root, scheduled):
    from lapp.models.features import Grammar
    client = _setup(app, db, media_root)
    job_id = _ready_job(client)
    passage_text = "Hello world"
    res = client.post(f"/api/ingestion/{job_id}/accept", json={
        "lesson_id": "lesson_L1",
        "items": [],
        "elements": [
            {"kind": "grammar", "fields": {
                "title": "Greeting",
                "explanation": "Say hello",
                "example_sentences": [passage_text, "Other example"]
            }}
        ]
    })
    assert res.status_code == 200 and res.get_json()["created_elements"] == 1

    with db.session_scope() as s:
        grammar = s.query(Grammar).filter(Grammar.title == "Greeting").first()
        assert len(grammar.example_sentences) == 2
        assert grammar.example_sentences[0].text == passage_text
        assert grammar.example_sentences[1].text == "Other example"


def test_accept_twice_creates_no_duplicate_elements(app, db, media_root, scheduled):
    from lapp.models.features import Calligraphy
    client = _setup(app, db, media_root)
    body = {
        "lesson_id": "lesson_L1",
        "items": [],
        "elements": [
            {"kind": "calligraphy", "fields": {"character": "同", "phonetic": None, "meaning": None, "radical": None, "strokes": None}}
        ]
    }

    job_id = _ready_job(client)
    res1 = client.post(f"/api/ingestion/{job_id}/accept", json=body)
    assert res1.status_code == 200 and res1.get_json()["created_elements"] == 1

    job_id = _ready_job(client)
    res2 = client.post(f"/api/ingestion/{job_id}/accept", json=body)
    assert res2.status_code == 200 and res2.get_json()["created_elements"] == 0

    with db.session_scope() as s:
        calligraphies = s.query(Calligraphy).filter(Calligraphy.lesson_id == "lesson_L1").all()
        assert len(calligraphies) == 1
        assert calligraphies[0].character.character == "同"


def test_accept_rejects_malformed_element(app, db, media_root, scheduled):
    from lapp.models.features import Grammar
    client = _setup(app, db, media_root)
    job_id = _ready_job(client)

    # Missing required field
    res = client.post(f"/api/ingestion/{job_id}/accept", json={
        "lesson_id": "lesson_L1",
        "items": [],
        "elements": [{"kind": "calligraphy", "fields": {"phonetic": "only phonetic"}}]
    })
    assert res.status_code == 400

    # Unknown kind
    job_id = _ready_job(client)
    res = client.post(f"/api/ingestion/{job_id}/accept", json={
        "lesson_id": "lesson_L1",
        "items": [],
        "elements": [{"kind": "unknown", "fields": {"text": "text"}}]
    })
    assert res.status_code == 400

    # Missing fields dict
    job_id = _ready_job(client)
    res = client.post(f"/api/ingestion/{job_id}/accept", json={
        "lesson_id": "lesson_L1",
        "items": [],
        "elements": [{"kind": "grammar"}]
    })
    assert res.status_code == 400


def test_accept_elements_without_items(app, db, media_root, scheduled):
    client = _setup(app, db, media_root)
    job_id = _ready_job(client)
    res = client.post(f"/api/ingestion/{job_id}/accept", json={
        "lesson_id": "lesson_L1",
        "elements": [{"kind": "calligraphy", "fields": {"character": "中", "phonetic": None, "meaning": None, "radical": None, "strokes": None}}]})
    assert res.status_code == 200 and res.get_json() == {"created": 0, "created_elements": 1}


# ---- source fields -----------------------------------------------------------

def test_upload_accepts_source_fields_with_validation(app, db, media_root, scheduled):
    client = _setup(app, db, media_root)
    res = _upload(client, source_title="HSK 2", source_type="textbook", source_description="Manual", level="2")
    assert res.status_code == 202
    job_id = res.get_json()["job_id"]
    job = svc.get(job_id)
    assert (job["source_title"], job["source_type"], job["source_description"], job["level"]) == ("HSK 2", "textbook", "Manual", 2)


def test_upload_rejects_invalid_source_type(app, db, media_root, scheduled):
    client = _setup(app, db, media_root)
    res = _upload(client, source_type="invalid_type")
    assert res.status_code == 400 and "source_type" in res.get_json()["error"]
    assert scheduled == []


def test_upload_rejects_invalid_level(app, db, media_root, scheduled):
    client = _setup(app, db, media_root)
    for level in ["0", "10", "x", "-1"]:
        res = _upload(client, level=level)
        assert res.status_code == 400 and ("level" in res.get_json()["error"] or "integer" in res.get_json()["error"]), f"level={level}"
    assert scheduled == []


def test_upload_strips_blank_strings_to_none(app, db, media_root, scheduled):
    client = _setup(app, db, media_root)
    res = _upload(client, source_title="  ", source_type="", source_description="", level="")
    assert res.status_code == 202
    job = svc.get(res.get_json()["job_id"])
    assert job["source_title"] is None and job["source_type"] is None
    assert job["source_description"] is None and job["level"] is None


def test_source_created_with_title_and_type_from_job_fields(app, db, media_root, scheduled):
    from lapp.models.system_data import Source
    client = _setup(app, db, media_root)
    job_id = _upload(client, source_title="HSK 2", source_type="textbook", source_description="Pages 20-26").get_json()["job_id"]
    svc.update(job_id, status="ready")
    candidates_path(media_root, job_id).write_text(json.dumps({"candidates": [{"word": "你好"}], "warnings": []}))
    client.post(f"/api/ingestion/{job_id}/accept", json={"lesson_id": "lesson_L1", "items": [{"word": "你好"}]})
    with db.session_scope() as s:
        sources = s.query(Source).filter(Source.user_id == "user_U1").all()
        assert len(sources) == 1
        assert (sources[0].title, sources[0].source_type, sources[0].description) == ("HSK 2", "textbook", "Pages 20-26")


def test_source_fallback_without_job_fields(app, db, media_root, scheduled):
    from lapp.models.system_data import Source
    client = _setup(app, db, media_root)
    job_id = _upload(client).get_json()["job_id"]  # no source fields
    svc.update(job_id, status="ready")
    candidates_path(media_root, job_id).write_text(json.dumps({"candidates": [{"word": "你好"}], "warnings": []}))
    client.post(f"/api/ingestion/{job_id}/accept", json={"lesson_id": "lesson_L1", "items": [{"word": "你好"}]})
    with db.session_scope() as s:
        sources = s.query(Source).filter(Source.user_id == "user_U1").all()
        assert len(sources) == 1
        assert "Imported from" in sources[0].title and sources[0].source_type == "other"


def test_source_reused_for_same_title(app, db, media_root, scheduled):
    from lapp.models.system_data import Source
    client = _setup(app, db, media_root)
    # First import
    job_id1 = _upload(client, source_title="HSK 2").get_json()["job_id"]
    svc.update(job_id1, status="ready")
    candidates_path(media_root, job_id1).write_text(json.dumps({"candidates": [{"word": "a"}], "warnings": []}))
    client.post(f"/api/ingestion/{job_id1}/accept", json={"lesson_id": "lesson_L1", "items": [{"word": "a"}]})
    # Second import with same title
    job_id2 = _upload(client, source_title="HSK 2").get_json()["job_id"]
    svc.update(job_id2, status="ready")
    candidates_path(media_root, job_id2).write_text(json.dumps({"candidates": [{"word": "b"}], "warnings": []}))
    client.post(f"/api/ingestion/{job_id2}/accept", json={"lesson_id": "lesson_L1", "items": [{"word": "b"}]})
    with db.session_scope() as s:
        sources = s.query(Source).filter(Source.user_id == "user_U1").all()
        assert len(sources) == 1
