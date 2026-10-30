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
    job_id = _upload(client).get_json()["job_id"]
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
