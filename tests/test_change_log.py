"""Edits by an editor of a shared lesson are logged with before/after, and only the owner can revert them."""
from collab_helpers import client_for, seed, share_lesson

from lapp.models.components import Word
from lapp.models.features import Grammar
from lapp.models.system_data import ChangeLog


def _edit_as_u2(app, title):
    c = client_for(app, "user_U2")
    res = c.put("/api/grammar/gram_G1", json={"lesson_id": "lesson_L1", "title": title, "explanation": "x"})
    assert res.status_code == 200, res.data


def _setup(db):
    seed(db)
    with db.session_scope() as s:
        db.insert(Grammar(id="gram_G1", lesson_id="lesson_L1", title="Original", explanation="x"), session=s, commit=False)
    share_lesson()


def test_editor_changes_are_logged_with_before_and_after(app, db):
    _setup(db)
    _edit_as_u2(app, "Edited by U2")
    with db.session_scope() as s:
        rows = s.query(ChangeLog).all()
        assert len(rows) == 1
        r = rows[0]
        assert (r.user_id, r.element_id, r.op, r.lesson_id) == ("user_U2", "gram_G1", "update", "lesson_L1")
        assert r.before["title"] == "Original" and r.after["title"] == "Edited by U2"


def test_the_owners_own_edits_are_not_logged(app, db):
    _setup(db)
    assert client_for(app, "user_U1").put("/api/grammar/gram_G1", json={"lesson_id": "lesson_L1", "title": "Mine", "explanation": "x"}).status_code == 200
    with db.session_scope() as s:
        assert s.query(ChangeLog).count() == 0


def test_owner_reverts_and_a_collaborator_cannot(app, db):
    _setup(db)
    _edit_as_u2(app, "Edited by U2")
    with db.session_scope() as s:
        change_id = s.query(ChangeLog).one().id
    assert client_for(app, "user_U2").post(f"/api/collaboration/changes/{change_id}/revert").status_code == 403
    listing = client_for(app, "user_U1").get("/api/collaboration/lesson/lesson_L1/changes")
    assert listing.status_code == 200 and listing.get_json()[0]["id"] == change_id
    assert client_for(app, "user_U2").get("/api/collaboration/lesson/lesson_L1/changes").status_code == 403
    assert client_for(app, "user_U1").post(f"/api/collaboration/changes/{change_id}/revert").status_code == 200
    with db.session_scope() as s:
        assert s.get(Grammar, "gram_G1").title == "Original"
        assert s.get(ChangeLog, change_id).reverted_at is not None
    assert client_for(app, "user_U1").post(f"/api/collaboration/changes/{change_id}/revert").status_code == 404     # once only
