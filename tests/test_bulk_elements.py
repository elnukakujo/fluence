"""Bulk delete / move / tag / source edits on lesson items (all or nothing)."""
from lapp.models.components import Word
from lapp.models.containers import Language, Lesson
from lapp.models.features import Grammar, Vocabulary
from lapp.models.system_data import Source, Tag, User
from lapp.services.auth import AuthService


def _user(db, uid):
    with db.session_scope() as s:
        db.insert(User(id=uid, username=uid, email=f"{uid}@x.com"), session=s, commit=False)
    return AuthService().create_session(uid, remember=False)


def _setup(app, db):
    token = _user(db, "user_U1")
    _user(db, "user_U2")
    with db.session_scope() as s:
        for lang, uid in (("lang_L1", "user_U1"), ("lang_L2", "user_U1"), ("lang_L3", "user_U2")):
            db.insert(Language(id=lang, user_id=uid, name=lang), session=s, commit=False)
        for lid, lang in (("lesson_L1", "lang_L1"), ("lesson_L2", "lang_L1"), ("lesson_L3", "lang_L2"), ("lesson_L4", "lang_L3")):
            db.insert(Lesson(id=lid, user_id="user_U2" if lang == "lang_L3" else "user_U1", language_id=lang, title=lid, position=0),
                      session=s, commit=False)
        db.insert(Word(id="word_W1", language_id="lang_L1", word="水"), session=s, commit=False)
        db.insert(Vocabulary(id="voc_V1", lesson_id="lesson_L1", word_id="word_W1"), session=s, commit=False)
        db.insert(Grammar(id="gram_G1", lesson_id="lesson_L1", title="g", explanation="e"), session=s, commit=False)
        db.insert(Grammar(id="gram_G2", lesson_id="lesson_L4", title="other", explanation="e"), session=s, commit=False)
        db.insert(Tag(id="tag_T1", name="t1", user_id="user_U1"), session=s, commit=False)
        db.insert(Tag(id="tag_T2", name="t2", user_id="user_U2"), session=s, commit=False)
        db.insert(Source(id="src_S1", title="s", source_type="textbook", user_id="user_U1"), session=s, commit=False)
    client = app.test_client()
    client.set_cookie('session_token', token)
    return client


def _rows(db, model):
    with db.session_scope() as s:
        return sorted((r.id, r.lesson_id) for r in s.query(model))


def test_bulk_delete_removes_all(app, db):
    c = _setup(app, db)
    res = c.post("/api/elements/bulk-delete", json={"ids": ["voc_V1", "gram_G1"]})
    assert res.status_code == 200 and res.get_json() == {"deleted": 2}
    assert _rows(db, Vocabulary) == [] and [r[0] for r in _rows(db, Grammar)] == ["gram_G2"]


def test_bulk_delete_is_all_or_nothing_when_one_is_not_owned(app, db):
    c = _setup(app, db)
    assert c.post("/api/elements/bulk-delete", json={"ids": ["voc_V1", "gram_G2"]}).status_code == 403
    assert len(_rows(db, Vocabulary)) == 1


def test_bulk_delete_rejects_empty_and_unknown_prefix(app, db):
    c = _setup(app, db)
    assert c.post("/api/elements/bulk-delete", json={"ids": []}).status_code == 400
    assert c.post("/api/elements/bulk-delete", json={"ids": ["lesson_L1"]}).status_code == 400


def test_bulk_tags_add_and_remove_without_duplicates(app, db):
    c = _setup(app, db)
    for _ in range(2):
        assert c.post("/api/elements/bulk-tags", json={"ids": ["voc_V1", "gram_G1"], "add": ["tag_T1"], "remove": []}).status_code == 200
    with db.session_scope() as s:
        assert [t.id for t in s.get(Vocabulary, "voc_V1").tags] == ["tag_T1"]
    assert c.post("/api/elements/bulk-tags", json={"ids": ["voc_V1"], "add": [], "remove": ["tag_T1"]}).status_code == 200
    with db.session_scope() as s:
        assert s.get(Vocabulary, "voc_V1").tags == [] and len(s.get(Grammar, "gram_G1").tags) == 1


def test_bulk_tags_rejects_another_users_tag(app, db):
    c = _setup(app, db)
    assert c.post("/api/elements/bulk-tags", json={"ids": ["voc_V1"], "add": ["tag_T2"], "remove": []}).status_code == 403


def test_bulk_sources_add(app, db):
    c = _setup(app, db)
    assert c.post("/api/elements/bulk-sources", json={"ids": ["voc_V1"], "add": ["src_S1"], "remove": []}).status_code == 200
    with db.session_scope() as s:
        assert [x.id for x in s.get(Vocabulary, "voc_V1").sources] == ["src_S1"]


def test_move_within_a_language_keeps_ids(app, db):
    c = _setup(app, db)
    res = c.post("/api/elements/bulk-move", json={"ids": ["voc_V1", "gram_G1"], "target_lesson_id": "lesson_L2"})
    assert res.status_code == 200 and res.get_json() == {"moved": 2, "skipped": []}
    assert _rows(db, Vocabulary) == [("voc_V1", "lesson_L2")] and ("gram_G1", "lesson_L2") in _rows(db, Grammar)


def test_move_rejects_same_lesson_other_language_and_unowned_target(app, db):
    c = _setup(app, db)
    body = {"ids": ["voc_V1"]}
    assert c.post("/api/elements/bulk-move", json={**body, "target_lesson_id": "lesson_L1"}).status_code == 400
    assert c.post("/api/elements/bulk-move", json={**body, "target_lesson_id": "lesson_L3"}).status_code == 400
    assert c.post("/api/elements/bulk-move", json={**body, "target_lesson_id": "lesson_L4"}).status_code == 403
    assert _rows(db, Vocabulary) == [("voc_V1", "lesson_L1")]
