import time

import pytest

from lapp.models.components import Word
from lapp.models.containers import Language, Lesson
from lapp.models.features import Exercise, Vocabulary
from lapp.models.system_data import User, UserPreferences
from lapp.services.auth import AuthService
from lapp.services.exercise_generation import jobs

TEXT = {"name": "t", "api_type": "text_gen", "base_url": "https://x/v1", "api_key": "k", "model": "m", "is_active": True}


def _user(db, uid, endpoints=(TEXT,), type_prefs=None):
    with db.session_scope() as s:
        db.insert(User(id=uid, username=uid, email=f"{uid}@x.com"), session=s, commit=False)
        db.insert(UserPreferences(id=f"pref_{uid}", user_id=uid, ai_endpoints=list(endpoints), exercise_type_prefs=type_prefs or {}), session=s, commit=False)


def _lesson(db, words=8):
    with db.session_scope() as s:
        db.insert(Language(id="lang_L1", user_id="user_U1", name="French", target_iso639_2t="fra", source_iso639_2t="eng"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="L", position=0), session=s, commit=False)
        for i in range(words):
            db.insert(Word(id=f"word_W{i}", language_id="lang_L1", word=f"w{i}"), session=s, commit=False)
            db.insert(Vocabulary(id=f"voc_V{i}", lesson_id="lesson_L1", word_id=f"word_W{i}"), session=s, commit=False)


def _client(app, uid):
    c = app.test_client()
    c.set_cookie("session_token", AuthService().create_session(uid, remember=False))
    return c


def _item(n, reason=None):
    return {"exercise_type": "essay", "question": f"Q{n}?", "answer": "A", "text_support": None, "content": None, "review_reason": None,
            "linked": ["w0"], "related_vocabulary": ["voc_V0"], "related_grammar": [], "related_calligraphy": []}


@pytest.fixture
def stub(monkeypatch):
    class S:
        reasons = [None, "answer is wrong", None]
        n = 3
    monkeypatch.setattr(jobs, "generate_batch", lambda slots, api, target, progress=lambda: None, **kw: [progress() or _item(i) for i in range(S.n)])
    monkeypatch.setattr(jobs, "judge_batch", lambda items, api, target, **kw: S.reasons[:len(items)])
    return S


def _wait(client, job_id):
    for _ in range(100):
        job = client.get(f"/api/exercise-generation/{job_id}").get_json()
        if job["state"] != "running":
            return job
        time.sleep(0.1)
    raise AssertionError("job never finished")


def test_suggest_returns_a_count_and_a_mix_without_banned_types(app, db):
    _user(db, "user_U1", type_prefs={"quizz": "ban"})
    _lesson(db)
    body = _client(app, "user_U1").get("/api/lesson/lesson_L1/exercises/suggest").get_json()
    assert body["count"] >= 6 and body["pool"] == 8 and sum(body["mix"].values()) == body["count"] and "quizz" not in body["mix"]


def test_suggest_on_an_empty_lesson_is_zero(app, db):
    _user(db, "user_U1")
    _lesson(db, words=0)
    assert _client(app, "user_U1").get("/api/lesson/lesson_L1/exercises/suggest").get_json() == {"count": 0, "mix": {}, "pool": 0}


def test_generate_saves_the_clean_ones_and_flags_the_doubtful(app, db, stub):
    _user(db, "user_U1")
    _lesson(db)
    c = _client(app, "user_U1")
    res = c.post("/api/lesson/lesson_L1/exercises/generate", json={"count": 6})
    assert res.status_code == 202
    job = _wait(c, res.get_json()["job_id"])
    assert job["state"] == "done" and job["done"] == job["total"]
    assert job["result"]["saved"] == 2 and len(job["result"]["flagged"]) == 1
    exercises = {e["id"]: e for e in c.get("/api/exercise/lesson/lesson_L1").get_json()}
    flagged = exercises[job["result"]["flagged"][0]]
    assert flagged["review_reason"] == "answer is wrong" and flagged["needs"] == ["review"]
    ok = [e for e in exercises.values() if not e["review_reason"]]
    assert len(ok) == 2 and all(e["needs"] == [] and e["generation_batch_id"] == job["result"]["batch_id"] and e["related_vocabulary"] == ["voc_V0"] for e in ok)


def test_generate_refuses_without_an_endpoint_an_empty_lesson_or_a_bad_count(app, db, stub):
    _user(db, "user_U1", endpoints=())
    _lesson(db)
    c = _client(app, "user_U1")
    r = c.post("/api/lesson/lesson_L1/exercises/generate", json={"count": 6})
    assert r.status_code == 409 and r.get_json()["error"] == "text_gen_not_configured"
    assert c.post("/api/lesson/lesson_L1/exercises/generate", json={"count": 0}).status_code == 400
    assert c.post("/api/lesson/lesson_L1/exercises/generate", json={"count": 61}).status_code == 400


def test_generate_on_an_empty_lesson_is_a_409(app, db, stub):
    _user(db, "user_U1")
    _lesson(db, words=0)
    r = _client(app, "user_U1").post("/api/lesson/lesson_L1/exercises/generate", json={"count": 6})
    assert r.status_code == 409 and r.get_json()["error"] == "empty_lesson"


def test_a_failing_job_reports_failed_and_saves_nothing(app, db, monkeypatch):
    _user(db, "user_U1")
    _lesson(db)
    def boom(*a, **k): raise RuntimeError("model down")
    monkeypatch.setattr(jobs, "generate_batch", boom)
    c = _client(app, "user_U1")
    job = _wait(c, c.post("/api/lesson/lesson_L1/exercises/generate", json={"count": 6}).get_json()["job_id"])
    assert job["state"] == "failed" and "model down" in job["error"]
    assert c.get("/api/exercise/lesson/lesson_L1").get_json() == []


def test_jobs_are_private_and_unknown_ones_404(app, db, stub):
    _user(db, "user_U1")
    _user(db, "user_U2")
    _lesson(db)
    c = _client(app, "user_U1")
    job_id = c.post("/api/lesson/lesson_L1/exercises/generate", json={"count": 6}).get_json()["job_id"]
    _wait(c, job_id)
    assert _client(app, "user_U2").get(f"/api/exercise-generation/{job_id}").status_code == 404
    assert c.get("/api/exercise-generation/nope").status_code == 404
    assert _client(app, "user_U2").post("/api/lesson/lesson_L1/exercises/generate", json={"count": 6}).status_code == 403


def test_undo_deletes_only_that_batch(app, db, stub):
    _user(db, "user_U1")
    _lesson(db)
    with db.session_scope() as s:
        db.insert(Exercise(id="ex_keep", lesson_id="lesson_L1", exercise_type="essay", question="q", answer="a"), session=s, commit=False)
    c = _client(app, "user_U1")
    job = _wait(c, c.post("/api/lesson/lesson_L1/exercises/generate", json={"count": 6}).get_json()["job_id"])
    res = c.delete(f"/api/exercise-batch/{job['result']['batch_id']}")
    assert res.get_json() == {"deleted": 3}
    assert [e["id"] for e in c.get("/api/exercise/lesson/lesson_L1").get_json()] == ["ex_keep"]


def test_the_job_passes_the_source_language_and_the_known_words_and_links_every_mentioned_word(app, db, monkeypatch):
    _user(db, "user_U1")
    _lesson(db)
    seen = {}
    def fake(slots, api, target, progress=lambda: None, **kw):
        seen.update(kw)
        return [{**_item(0), "question": "Use w3 and w5 here"}]
    monkeypatch.setattr(jobs, "generate_batch", fake)
    monkeypatch.setattr(jobs, "judge_batch", lambda items, api, target, **kw: [None] * len(items))
    c = _client(app, "user_U1")
    job = _wait(c, c.post("/api/lesson/lesson_L1/exercises/generate", json={"count": 6}).get_json()["job_id"])
    assert job["state"] == "done"
    assert seen["source"] == "English" and {"w0", "w7"} <= set(seen["known"])
    [made] = c.get("/api/exercise/lesson/lesson_L1").get_json()
    assert set(made["related_vocabulary"]) == {"voc_V0", "voc_V3", "voc_V5"}
