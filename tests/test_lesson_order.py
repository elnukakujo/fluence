"""Lesson order (position), reorder and bulk delete."""
from datetime import datetime, timedelta

from lapp.models.components import Word
from lapp.models.containers import Language, Lesson
from lapp.models.features import Vocabulary
from lapp.models.system_data import User
from lapp.services import LessonService
from lapp.services.auth import AuthService

svc = LessonService()


def _user(db, uid):
    with db.session_scope() as s:
        db.insert(User(id=uid, username=uid, email=f"{uid}@x.com"), session=s, commit=False)
    return AuthService().create_session(uid, remember=False)


def _setup(app, db, n=3, lang="lang_L1", uid="user_U1"):
    token = _user(db, uid)
    with db.session_scope() as s:
        db.insert(Language(id=lang, user_id=uid, name=f"Lang {lang}"), session=s, commit=False)
        for i in range(n):  # created_at reversed to prove position, not creation time, decides the order
            db.insert(Lesson(id=f"lesson_{lang}_{i}", user_id=uid, language_id=lang, title=f"T{i}", position=i,
                             created_at=datetime(2026, 1, 1) + timedelta(days=n - i)), session=s, commit=False)
    client = app.test_client()
    client.set_cookie('session_token', token)
    return client


def _order(lang="lang_L1"):
    return [l["id"] for l in svc.get_all(lang, as_dict=True)]


def test_get_all_orders_by_position_not_creation_time(app, db):
    _setup(app, db)
    assert _order() == ["lesson_lang_L1_0", "lesson_lang_L1_1", "lesson_lang_L1_2"]


def test_new_lessons_are_appended(app, db):
    client = _setup(app, db)
    res = client.post('/api/lessons/', json={"language_id": "lang_L1", "title": "new"})
    assert res.status_code == 201
    assert _order()[-1] == res.get_json()["lesson"]["id"]
    assert res.get_json()["lesson"]["position"] == 3


def test_reorder_applies_the_new_order(app, db):
    client = _setup(app, db)
    ids = ["lesson_lang_L1_2", "lesson_lang_L1_0", "lesson_lang_L1_1"]
    res = client.post('/api/lessons/reorder', json={"language_id": "lang_L1", "ids": ids})
    assert res.status_code == 200 and _order() == ids


def test_reorder_rejects_a_wrong_id_set_and_leaves_the_order(app, db):
    client = _setup(app, db)
    bad = [
        ["lesson_lang_L1_0", "lesson_lang_L1_1"],                                   # missing
        ["lesson_lang_L1_0", "lesson_lang_L1_1", "lesson_lang_L1_2", "lesson_lang_L1_2"],   # extra / duplicate
        ["lesson_lang_L1_0", "lesson_lang_L1_1", "lesson_lang_L1_1"],                   # duplicate in place of one
        ["lesson_lang_L1_0", "lesson_lang_L1_1", "nope"],                           # unknown
        [],
    ]
    for ids in bad:
        assert client.post('/api/lessons/reorder', json={"language_id": "lang_L1", "ids": ids}).status_code == 400, ids
    assert _order() == ["lesson_lang_L1_0", "lesson_lang_L1_1", "lesson_lang_L1_2"]


def test_reorder_rejects_a_lesson_of_another_language(app, db):
    client = _setup(app, db)
    with db.session_scope() as s:
        db.insert(Language(id="lang_L2", user_id="user_U1", name="Other"), session=s, commit=False)
        db.insert(Lesson(id="lesson_other", user_id="user_U1", language_id="lang_L2", title="x", position=0), session=s, commit=False)
    res = client.post('/api/lessons/reorder', json={"language_id": "lang_L1", "ids": ["lesson_lang_L1_0", "lesson_lang_L1_1", "lesson_other"]})
    assert res.status_code == 400 and _order() == ["lesson_lang_L1_0", "lesson_lang_L1_1", "lesson_lang_L1_2"]


def test_reorder_by_a_non_owner_is_forbidden(app, db):
    _setup(app, db)
    token_b = _user(db, "user_U2")
    other = app.test_client()
    other.set_cookie('session_token', token_b)
    ids = ["lesson_lang_L1_2", "lesson_lang_L1_1", "lesson_lang_L1_0"]
    assert other.post('/api/lessons/reorder', json={"language_id": "lang_L1", "ids": ids}).status_code == 403
    assert _order() == ["lesson_lang_L1_0", "lesson_lang_L1_1", "lesson_lang_L1_2"]


def test_bulk_delete_removes_only_the_given_lessons_and_their_features(app, db):
    client = _setup(app, db)
    with db.session_scope() as s:
        db.insert(Word(id="word_W1", language_id="lang_L1", word="水"), session=s, commit=False)
        db.insert(Vocabulary(id="voc_V1", lesson_id="lesson_lang_L1_0", word_id="word_W1"), session=s, commit=False)
    res = client.post('/api/lessons/bulk-delete', json={"ids": ["lesson_lang_L1_0", "lesson_lang_L1_2"]})
    assert res.status_code == 200 and res.get_json() == {"deleted": 2}
    assert _order() == ["lesson_lang_L1_1"]
    with db.session_scope() as s:
        assert s.get(Vocabulary, "voc_V1") is None


def test_bulk_delete_with_a_foreign_lesson_deletes_nothing(app, db):
    client = _setup(app, db)
    _setup(app, db, n=1, lang="lang_L2", uid="user_U2")
    res = client.post('/api/lessons/bulk-delete', json={"ids": ["lesson_lang_L1_0", "lesson_lang_L2_0"]})
    assert res.status_code == 403
    assert len(_order()) == 3 and len(_order("lang_L2")) == 1


def test_bulk_delete_needs_ids(app, db):
    client = _setup(app, db)
    assert client.post('/api/lessons/bulk-delete', json={"ids": []}).status_code == 400
    assert client.post('/api/lessons/bulk-delete', json={}).status_code == 400


def test_language_lesson_ids_follow_the_order(app, db):
    client = _setup(app, db)
    ids = ["lesson_lang_L1_2", "lesson_lang_L1_0", "lesson_lang_L1_1"]
    client.post('/api/lessons/reorder', json={"language_id": "lang_L1", "ids": ids})
    assert client.get('/api/languages/lang_L1').get_json()["lesson_ids"] == ids
