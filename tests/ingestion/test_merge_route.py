import io

from ingestion_seeds import client_for, make_language, make_user
from lapp.services.ingestion import grammar as grammar_module
from lapp.utils.model_api import ModelAPIError

ITEMS = [{"title": "A", "explanation": "Part one. 例1。", "original_text": "ORIG-ONE"},
         {"title": "B", "explanation": "Part two. 例2。", "original_text": "ORIG-TWO"}]


def _client(app, db):
    make_user(db, "user_U1")
    make_language(db, "user_U1")
    client = client_for(app, "user_U1")
    job_id = client.post("/api/ingestion", data={"language_id": "lang_L1", "file": (io.BytesIO(b"%PDF-1.4 fake"), "b.pdf")},
                         content_type="multipart/form-data").get_json()["job_id"]
    return client, job_id


def _text_api(monkeypatch):
    monkeypatch.setattr("lapp.api.routes.ingestion.resolve_api", lambda *a, **k: {"base_url": "x", "model": "m"})


def test_merge_sends_originals_and_forbids_summaries(app, db, scheduled, monkeypatch):
    client, job_id = _client(app, db)
    _text_api(monkeypatch)
    seen = {}

    def fake(**kw):
        seen["msgs"] = kw["messages"]
        return '{"title": "AB", "explanation": "Part one. 例1。 Part two. 例2。", "example_sentences": ["例1。", "not in text"]}'
    monkeypatch.setattr(grammar_module, "chat_completion", fake)
    r = client.post(f"/api/ingestion/{job_id}/merge", json={"items": ITEMS})
    assert r.status_code == 200, r.get_json()
    assert r.get_json() == {"title": "AB", "explanation": "Part one. 例1。 Part two. 例2。", "example_sentences": ["例1。"], "corrections": []}
    prompt = " ".join(m["content"] for m in seen["msgs"])
    assert "Do NOT summarise" in prompt and "ORIG-ONE" in prompt and "ORIG-TWO" in prompt


def test_merge_model_error_is_502(app, db, scheduled, monkeypatch):
    client, job_id = _client(app, db)
    _text_api(monkeypatch)

    def boom(**kw):
        raise ModelAPIError(ModelAPIError.KIND_SERVER, 500, "down")
    monkeypatch.setattr(grammar_module, "chat_completion", boom)
    r = client.post(f"/api/ingestion/{job_id}/merge", json={"items": ITEMS})
    assert r.status_code == 502 and "down" in r.get_json()["error"]


def test_merge_needs_two_items_and_own_job(app, db, scheduled):
    client, job_id = _client(app, db)
    assert client.post(f"/api/ingestion/{job_id}/merge", json={"items": ITEMS[:1]}).status_code == 400
    assert client.post("/api/ingestion/ing_nope/merge", json={"items": ITEMS}).status_code == 404


def test_regenerate_redoes_one_candidate_from_its_original_text(app, db, scheduled, monkeypatch):
    client, job_id = _client(app, db)
    _text_api(monkeypatch)
    seen = {}

    def fake(**kw):
        seen["user"] = kw["messages"][-1]["content"]
        return '{"title": "A", "explanation": "Full text. 例1。", "example_sentences": ["例1。"]}'
    monkeypatch.setattr(grammar_module, "chat_completion", fake)
    r = client.post(f"/api/ingestion/{job_id}/regenerate", json={"items": ITEMS[:1]})
    assert r.status_code == 200 and r.get_json()["explanation"] == "Full text. 例1。" and "ORIG-ONE" in seen["user"]
    assert client.post(f"/api/ingestion/{job_id}/regenerate", json={"items": ITEMS}).status_code == 400


def test_enhance_uses_the_users_source_language_and_not_the_page_text(app, db, scheduled, monkeypatch):
    client, job_id = _client(app, db)
    _text_api(monkeypatch)
    seen = {}

    def fake(**kw):
        seen["system"], seen["user"] = kw["messages"][0]["content"], kw["messages"][-1]["content"]
        return '{"title": "A", "explanation": "Part one. 例1。\\n\\n**Explanation (added by the model)**\\nx", "example_sentences": []}'
    monkeypatch.setattr(grammar_module, "chat_completion", fake)
    r = client.post(f"/api/ingestion/{job_id}/regenerate", json={"items": ITEMS[:1], "request": "explain"})
    assert r.status_code == 200
    assert "Write the added explanation in English" in seen["system"]      # the seeded language's native language is eng
    assert "ORIG-ONE" not in seen["user"] and "Request from the user: explain" in seen["user"]
