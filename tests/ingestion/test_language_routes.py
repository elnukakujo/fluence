import io
import json

import pytest

from ingestion_seeds import client_for, make_language, make_user
from lapp.models.containers import Lesson
from lapp.models.features import Vocabulary
from lapp.services.ingestion.jobs import IngestionJobService, candidates_path, created_lesson_path, document_path

svc = IngestionJobService()

LESSONS = [{"title": "Salutations", "start_page": 1, "end_page": 2}, {"title": "Merci", "start_page": 3, "end_page": 4}]


def _upload(client, **form):
    return client.post("/api/ingestion", data={"language_id": "lang_L1", **form,
                       "file": (io.BytesIO(b"%PDF-1.4 fake"), "book.pdf")}, content_type="multipart/form-data")


def _setup(app, db):
    make_user(db, "user_U1")
    make_language(db, "user_U1")
    return client_for(app, "user_U1")


def _structure(confirmed=False, statuses=("pending", "pending")):
    return {"confirmed": confirmed, "first_page": 1, "last_page": 4,
            "lessons": [{**l, "index": i, "verified": True, "note": None, "status": statuses[i], "error": None,
                         "counts": None} for i, l in enumerate(LESSONS)]}


def _awaiting_structure(client):
    job_id = _upload(client).get_json()["job_id"]
    svc.update(job_id, status="structure", structure=_structure())
    return job_id


def _finished(client, media_root):
    job_id = _upload(client).get_json()["job_id"]
    svc.update(job_id, status="ready", structure=_structure(True, ("done", "done")))
    for i, word in enumerate(["bonjour", "merci"]):
        path = candidates_path(media_root, job_id, i)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"candidates": [{"id": f"c{i}", "word": word, "status": "verified", "flags": []}], "warnings": []}))
    return job_id


def test_upload_without_a_lesson_starts_a_language_level_job(app, db, media_root, scheduled):
    client = _setup(app, db)
    res = _upload(client)
    assert res.status_code == 202 and svc.get(res.get_json()["job_id"])["lesson_id"] is None


def test_structure_is_409_until_the_lessons_were_proposed(app, db, media_root, scheduled):
    client = _setup(app, db)
    job_id = _upload(client).get_json()["job_id"]
    assert client.get(f"/api/ingestion/{job_id}/structure").status_code == 409


def test_structure_is_returned_to_the_owner_only(app, db, media_root, scheduled):
    client = _setup(app, db)
    job_id = _awaiting_structure(client)
    body = client.get(f"/api/ingestion/{job_id}/structure").get_json()
    assert body["confirmed"] is False and [l["title"] for l in body["lessons"]] == ["Salutations", "Merci"]
    make_user(db, "user_U2")
    assert client_for(app, "user_U2").get(f"/api/ingestion/{job_id}/structure").status_code == 404


def test_confirming_a_valid_structure_starts_extraction(app, db, media_root, scheduled, monkeypatch):
    client = _setup(app, db)
    job_id = _awaiting_structure(client)
    started = []
    monkeypatch.setattr(app.scheduler, "schedule_extraction", lambda a, jid: started.append(jid))
    edited = [{"title": "  Greetings ", "start_page": 1, "end_page": 2}, {"title": "Thanks", "start_page": 3, "end_page": 4}]
    res = client.post(f"/api/ingestion/{job_id}/structure", json={"lessons": edited})
    assert res.status_code == 200 and started == [job_id]
    job = svc.get(job_id)
    assert job["status"] == "extracting" and job["structure"]["confirmed"] is True
    assert [l["title"] for l in job["structure"]["lessons"]] == ["Greetings", "Thanks"]
    assert all(l["status"] == "pending" for l in job["structure"]["lessons"])


@pytest.mark.parametrize("lessons", [[], [{"title": "", "start_page": 1, "end_page": 2}],
                                     [{"title": "A", "start_page": 1, "end_page": 9}],
                                     [{"title": "A", "start_page": 1, "end_page": 3}, {"title": "B", "start_page": 3, "end_page": 4}]])
def test_invalid_structures_are_rejected_without_changing_the_job(app, db, media_root, scheduled, monkeypatch, lessons):
    client = _setup(app, db)
    job_id = _awaiting_structure(client)
    monkeypatch.setattr(app.scheduler, "schedule_extraction", lambda a, jid: pytest.fail("scheduled"))
    res = client.post(f"/api/ingestion/{job_id}/structure", json={"lessons": lessons})
    assert res.status_code == 400 and res.get_json()["error"]
    assert svc.get(job_id)["status"] == "structure"


def test_structure_can_only_be_confirmed_once(app, db, media_root, scheduled, monkeypatch):
    client = _setup(app, db)
    job_id = _awaiting_structure(client)
    monkeypatch.setattr(app.scheduler, "schedule_extraction", lambda a, jid: None)
    assert client.post(f"/api/ingestion/{job_id}/structure", json={"lessons": LESSONS}).status_code == 200
    assert client.post(f"/api/ingestion/{job_id}/structure", json={"lessons": LESSONS}).status_code == 409


def test_language_candidates_are_grouped_by_lesson_and_only_finished_ones_carry_items(app, db, media_root, scheduled):
    client = _setup(app, db)
    job_id = _upload(client).get_json()["job_id"]
    svc.update(job_id, status="extracting", structure=_structure(True, ("done", "pending")))
    path = candidates_path(media_root, job_id, 0)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"candidates": [{"id": "c0", "word": "bonjour"}], "warnings": []}))
    body = client.get(f"/api/ingestion/{job_id}/candidates").get_json()
    assert [l["title"] for l in body["lessons"]] == ["Salutations", "Merci"]
    assert body["lessons"][0]["candidates"] == [{"id": "c0", "word": "bonjour"}]
    assert "candidates" not in body["lessons"][1] or body["lessons"][1]["candidates"] == []


def test_language_candidates_are_409_before_the_structure_is_confirmed(app, db, media_root, scheduled):
    client = _setup(app, db)
    job_id = _awaiting_structure(client)
    assert client.get(f"/api/ingestion/{job_id}/candidates").status_code == 409


def test_accepting_a_lesson_creates_the_lesson_and_its_vocabulary_once(app, db, media_root, scheduled):
    client = _setup(app, db)
    job_id = _finished(client, media_root)
    url = f"/api/ingestion/{job_id}/lessons/0/accept"
    res = client.post(url, json={"title": "Salutations", "items": [{"word": "bonjour", "translation": "hello"}]})
    assert res.status_code == 200
    lesson_id = res.get_json()["lesson_id"]
    again = client.post(url, json={"items": [{"word": "salut"}]})                 # same lesson, no duplicate
    assert again.get_json()["lesson_id"] == lesson_id
    with db.session_scope() as s:
        lessons = s.query(Lesson).filter(Lesson.language_id == "lang_L1", Lesson.id != "lesson_L1").all()
        assert [(l.title, l.user_id) for l in lessons] == [("Salutations", "user_U1")]
        assert s.query(Vocabulary).filter(Vocabulary.lesson_id == lesson_id).count() == 2
    assert created_lesson_path(media_root, job_id, 0).read_text() == lesson_id


def test_each_lesson_gets_its_own_lesson(app, db, media_root, scheduled):
    client = _setup(app, db)
    job_id = _finished(client, media_root)
    a = client.post(f"/api/ingestion/{job_id}/lessons/0/accept", json={"items": [{"word": "bonjour"}]}).get_json()["lesson_id"]
    b = client.post(f"/api/ingestion/{job_id}/lessons/1/accept", json={"items": [{"word": "merci"}]}).get_json()["lesson_id"]
    assert a != b


def test_accepting_a_lesson_validates_state_and_input(app, db, media_root, scheduled):
    client = _setup(app, db)
    job_id = _upload(client).get_json()["job_id"]
    svc.update(job_id, status="extracting", structure=_structure(True, ("done", "pending")))
    assert client.post(f"/api/ingestion/{job_id}/lessons/1/accept", json={"items": [{"word": "a"}]}).status_code == 409
    assert client.post(f"/api/ingestion/{job_id}/lessons/7/accept", json={"items": [{"word": "a"}]}).status_code == 404
    assert client.post(f"/api/ingestion/{job_id}/lessons/0/accept", json={"items": []}).status_code == 400
    assert client.post(f"/api/ingestion/{job_id}/lessons/0/accept", json={"items": [{"word": " "}]}).status_code == 400
    make_user(db, "user_U2")
    assert client_for(app, "user_U2").post(f"/api/ingestion/{job_id}/lessons/0/accept", json={"items": [{"word": "a"}]}).status_code == 404


def test_lesson_accept_is_rejected_for_a_lesson_level_job(app, db, media_root, scheduled):
    client = _setup(app, db)
    job_id = _upload(client, lesson_id="lesson_L1").get_json()["job_id"]
    svc.update(job_id, status="ready")
    assert client.post(f"/api/ingestion/{job_id}/lessons/0/accept", json={"items": [{"word": "a"}]}).status_code == 400


def test_nothing_is_created_when_a_lesson_accept_fails_validation(app, db, media_root, scheduled):
    client = _setup(app, db)
    job_id = _finished(client, media_root)
    client.post(f"/api/ingestion/{job_id}/lessons/0/accept", json={"items": [{"word": "ok"}, {"word": "x", "on_conflict": "boom"}]})
    with db.session_scope() as s:
        assert s.query(Lesson).filter(Lesson.id != "lesson_L1").count() == 0


KINDS = {"1": ["vocabulary"], "2": [], "3": ["grammar"], "4": ["passage"]}


def test_language_structure_includes_page_kinds(app, db, media_root, scheduled):
    client = _setup(app, db)
    job_id = _awaiting_structure(client)
    svc.update(job_id, page_kinds=KINDS)
    assert client.get(f"/api/ingestion/{job_id}/structure").get_json()["page_kinds"] == KINDS


def test_structure_post_overrides_page_kinds(app, db, media_root, scheduled, monkeypatch):
    client = _setup(app, db)
    job_id = _awaiting_structure(client)
    svc.update(job_id, page_kinds=KINDS)
    monkeypatch.setattr(app.scheduler, "schedule_extraction", lambda a, jid: None)
    res = client.post(f"/api/ingestion/{job_id}/structure", json={"lessons": LESSONS, "page_kinds": {"2": ["grammar"]}})
    assert res.status_code == 200
    assert svc.get(job_id)["page_kinds"] == {**KINDS, "2": ["grammar"]}


def test_structure_post_rejects_bad_page_kinds(app, db, media_root, scheduled, monkeypatch):
    client = _setup(app, db)
    job_id = _awaiting_structure(client)
    monkeypatch.setattr(app.scheduler, "schedule_extraction", lambda a, jid: pytest.fail("scheduled"))
    res = client.post(f"/api/ingestion/{job_id}/structure", json={"lessons": LESSONS, "page_kinds": {"1": ["wizard"]}})
    assert res.status_code == 400 and svc.get(job_id)["status"] == "structure"
