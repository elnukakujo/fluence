"""Language order (position), reorder, bulk delete, and tags on lessons / languages through the bulk endpoint."""
from lapp.models.containers import Language, Lesson
from lapp.models.system_data import Tag, User
from lapp.services import LanguageService
from lapp.services.auth import AuthService

svc = LanguageService()


def _setup(app, db, n=3, uid="user_U1"):
    with db.session_scope() as s:
        db.insert(User(id=uid, username=uid, email=f"{uid}@x.com"), session=s, commit=False)
        for i in range(n):
            db.insert(Language(id=f"lang_L{i}", user_id=uid, name=f"Lang {i}", position=i), session=s, commit=False)
        db.insert(Lesson(id="lesson_X", user_id=uid, language_id="lang_L0", title="T"), session=s, commit=False)
        db.insert(Tag(id="tag_T1", user_id=uid, name="t", color="#000"), session=s, commit=False)
    client = app.test_client()
    client.set_cookie('session_token', AuthService().create_session(uid, remember=False))
    return client


def _order(uid="user_U1"):
    return [l["id"] for l in svc.get_by_user_id(uid, as_dict=True)]


def test_reorder_languages(app, db):
    client = _setup(app, db)
    assert _order() == ["lang_L0", "lang_L1", "lang_L2"]
    assert client.post('/api/languages/reorder', json={"ids": ["lang_L2", "lang_L0", "lang_L1"]}).status_code == 200
    assert _order() == ["lang_L2", "lang_L0", "lang_L1"]


def test_reorder_rejects_partial_ids(app, db):
    client = _setup(app, db)
    assert client.post('/api/languages/reorder', json={"ids": ["lang_L0"]}).status_code == 400


def test_bulk_delete_languages(app, db):
    client = _setup(app, db)
    res = client.post('/api/languages/bulk-delete', json={"ids": ["lang_L1", "lang_L2"]})
    assert res.get_json() == {"deleted": 2}
    assert _order() == ["lang_L0"]


def test_bulk_tags_accept_lessons_and_languages(app, db):
    client = _setup(app, db)
    res = client.post('/api/elements/bulk-tags', json={"ids": ["lesson_X", "lang_L0"], "add": ["tag_T1"], "remove": []})
    assert res.status_code == 200 and res.get_json() == {"updated": 2}


def test_bulk_delete_elements_still_refuses_containers(app, db):
    client = _setup(app, db)
    assert client.post('/api/elements/bulk-delete', json={"ids": ["lang_L0"]}).status_code == 400
