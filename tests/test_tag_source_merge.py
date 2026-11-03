"""Merging two tags / two sources into one."""
from lapp.models.containers import Language, Lesson
from lapp.models.features import Grammar, Vocabulary
from lapp.models.components import Word
from lapp.models.system_data import Source, Tag, User
from lapp.services.auth import AuthService


def _setup(app, db):
    with db.session_scope() as s:
        for uid in ("user_U1", "user_U2"):
            db.insert(User(id=uid, username=uid, email=f"{uid}@x.com"), session=s, commit=False)
    token = AuthService().create_session("user_U1", remember=False)
    with db.session_scope() as s:
        db.insert(Language(id="lang_L1", user_id="user_U1", name="A"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="t", position=0), session=s, commit=False)
        db.insert(Word(id="word_W1", language_id="lang_L1", word="水"), session=s, commit=False)
        db.insert(Vocabulary(id="voc_V1", lesson_id="lesson_L1", word_id="word_W1"), session=s, commit=False)
        db.insert(Grammar(id="gram_G1", lesson_id="lesson_L1", title="g", explanation="e"), session=s, commit=False)
        for i, uid in ((1, "user_U1"), (2, "user_U1"), (3, "user_U1"), (4, "user_U2")):
            db.insert(Tag(id=f"tag_T{i}", name=f"t{i}", user_id=uid), session=s, commit=False)
            db.insert(Source(id=f"src_S{i}", title=f"s{i}", source_type="textbook", user_id=uid), session=s, commit=False)
        voc, gram = s.get(Vocabulary, "voc_V1"), s.get(Grammar, "gram_G1")
        voc.tags, gram.tags = [s.get(Tag, "tag_T1"), s.get(Tag, "tag_T2")], [s.get(Tag, "tag_T2")]   # voc has both
        voc.sources, gram.sources = [s.get(Source, "src_S1"), s.get(Source, "src_S2")], [s.get(Source, "src_S2")]
    client = app.test_client()
    client.set_cookie('session_token', token)
    return client


def _links(db, attr):
    with db.session_scope() as s:
        return {e: sorted(x.id for x in getattr(s.get(m, e), attr)) for e, m in (("voc_V1", Vocabulary), ("gram_G1", Grammar))}


def test_tag_merge_moves_links_keeps_one_link_for_both_and_deletes_the_other(app, db):
    c = _setup(app, db)
    res = c.post("/api/tags/merge", json={"keep_id": "tag_T1", "merge_id": "tag_T2"})
    assert res.status_code == 200 and res.get_json()["id"] == "tag_T1"
    assert _links(db, "tags") == {"voc_V1": ["tag_T1"], "gram_G1": ["tag_T1"]}
    with db.session_scope() as s:
        assert s.get(Tag, "tag_T2") is None


def test_tag_merge_applies_overrides_and_can_reuse_the_deleted_name(app, db):
    c = _setup(app, db)
    res = c.post("/api/tags/merge", json={"keep_id": "tag_T1", "merge_id": "tag_T2", "name": "t2", "color": "#fff"})
    assert res.status_code == 200 and (res.get_json()["name"], res.get_json()["color"]) == ("t2", "#fff")


def test_tag_merge_rejects_a_third_tags_name_blank_and_same_id(app, db):
    c = _setup(app, db)
    assert c.post("/api/tags/merge", json={"keep_id": "tag_T1", "merge_id": "tag_T2", "name": "t3"}).status_code == 400
    assert c.post("/api/tags/merge", json={"keep_id": "tag_T1", "merge_id": "tag_T2", "name": "  "}).status_code == 400
    assert c.post("/api/tags/merge", json={"keep_id": "tag_T1", "merge_id": "tag_T1"}).status_code == 400
    with db.session_scope() as s:
        assert s.get(Tag, "tag_T2") is not None


def test_tag_merge_of_another_users_tag_is_403_and_changes_nothing(app, db):
    c = _setup(app, db)
    assert c.post("/api/tags/merge", json={"keep_id": "tag_T1", "merge_id": "tag_T4"}).status_code == 403
    assert c.post("/api/tags/merge", json={"keep_id": "tag_T1", "merge_id": "tag_nope"}).status_code == 404
    assert _links(db, "tags")["voc_V1"] == ["tag_T1", "tag_T2"]


def test_source_merge_moves_links_and_applies_overrides(app, db):
    c = _setup(app, db)
    res = c.post("/api/sources/merge", json={"keep_id": "src_S1", "merge_id": "src_S2", "title": "Merged", "source_type": "class", "date": "2026-01-02"})
    body = res.get_json()
    assert res.status_code == 200 and (body["title"], body["source_type"], body["date"]) == ("Merged", "class", "2026-01-02")
    assert _links(db, "sources") == {"voc_V1": ["src_S1"], "gram_G1": ["src_S1"]}


def test_source_merge_rejects_bad_type_date_and_foreign_source(app, db):
    c = _setup(app, db)
    assert c.post("/api/sources/merge", json={"keep_id": "src_S1", "merge_id": "src_S2", "source_type": "nope"}).status_code == 400
    assert c.post("/api/sources/merge", json={"keep_id": "src_S1", "merge_id": "src_S2", "date": "x"}).status_code == 400
    assert c.post("/api/sources/merge", json={"keep_id": "src_S1", "merge_id": "src_S4"}).status_code == 403
