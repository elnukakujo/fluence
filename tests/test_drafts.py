"""AI drafts: excluded from the queue, spares and search until accepted; accept and reject through the inbox."""
import lapp.services  # noqa: F401
from lapp.models.containers import Language, Lesson
from lapp.models.features import Exercise
from lapp.models.system_data import User
from lapp.services.auth import AuthService


def _setup(app, db, uid="user_U1"):
    with db.session_scope() as s:
        db.insert(User(id=uid, username=uid, email=f"{uid}@x.com"), session=s, commit=False)
        db.insert(Language(id=f"lang_{uid}", user_id=uid, name="French", iso1="fr", target_iso639_2t="fra"), session=s, commit=False)
        db.insert(Lesson(id=f"lesson_{uid}", user_id=uid, language_id=f"lang_{uid}", title="L"), session=s, commit=False)
        db.insert(Exercise(id=f"ex_{uid}", lesson_id=f"lesson_{uid}", exercise_type="true_false", question="Le chat est noir ?",
                           answer="true", content={"statement": "Le chat est noir", "answer": True},
                           machine_made=True, draft=True), session=s, commit=False)
    c = app.test_client()
    c.set_cookie("session_token", AuthService().create_session(uid, remember=False))
    return c


def _found(c, text):
    res = c.get("/api/search", query_string={"query": text, "q": text})
    assert res.status_code == 200, res.data
    return "ex_user_U1" in res.get_data(as_text=True)


def test_a_draft_is_not_ready_and_not_found_by_search_until_accepted(app, db):
    c = _setup(app, db)
    with db.session_scope() as s:
        assert "draft" in s.get(Exercise, "ex_user_U1").needs
    assert not _found(c, "chat")
    c.post("/api/inbox/accept", json={"ids": ["ex_user_U1"]})
    assert _found(c, "chat")


def test_inbox_lists_and_counts_only_my_drafts(app, db):
    c = _setup(app, db)
    with db.session_scope() as s:
        db.insert(User(id="user_U2", username="v", email="v@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_2", user_id="user_U2", name="French", iso1="fr", target_iso639_2t="fra"), session=s, commit=False)
        db.insert(Lesson(id="lesson_2", user_id="user_U2", language_id="lang_2", title="L"), session=s, commit=False)
        db.insert(Exercise(id="ex_other", lesson_id="lesson_2", exercise_type="true_false", question="q", answer="true",
                           content={"statement": "s", "answer": True}, machine_made=True, draft=True), session=s, commit=False)
    data = c.get("/api/inbox").get_json()
    assert data["count"] == 1 and [e["id"] for e in data["groups"]["exercise"]] == ["ex_user_U1"]
    assert c.post("/api/inbox/accept", json={"ids": ["ex_other"]}).get_json() == {"accepted": 0}     # not mine: untouched
    with db.session_scope() as s:
        assert s.get(Exercise, "ex_other").draft is True


def test_accept_makes_it_ready_and_keeps_machine_made(app, db):
    c = _setup(app, db)
    assert c.post("/api/inbox/accept", json={"ids": ["ex_user_U1"]}).get_json() == {"accepted": 1}
    with db.session_scope() as s:
        ex = s.get(Exercise, "ex_user_U1")
        assert ex.draft is False and ex.machine_made is True and "draft" not in ex.needs
    assert c.get("/api/inbox").get_json()["count"] == 0


def test_reject_deletes(app, db):
    c = _setup(app, db)
    assert c.post("/api/inbox/reject", json={"ids": ["ex_user_U1"]}).get_json() == {"rejected": 1}
    with db.session_scope() as s:
        assert s.get(Exercise, "ex_user_U1") is None
    assert c.post("/api/inbox/accept", json={}).status_code == 400
