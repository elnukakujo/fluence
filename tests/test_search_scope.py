"""Search covers every element type, with shared content visible to the collaborator only."""
from collab_helpers import client_for, seed, share_lesson

from lapp.models.components import Character
from lapp.models.features import Exercise
from lapp.models.system_data import Source, Tag


def _types(c, q):
    res = c.get("/api/search", query_string={"q": q})
    assert res.status_code == 200, res.data
    return {(r["type"], r["id"]): r for r in res.get_json()["results"]}


def test_every_kind_is_found_and_radicals_are_flagged(app, db):
    seed(db)
    with db.session_scope() as s:
        db.insert(Character(id="char_C1", language_id="lang_L1", character="氵", meaning="water radical"), session=s, commit=False)
        db.insert(Character(id="char_C2", language_id="lang_L1", character="海", meaning="sea", key_radical_id="char_C1"), session=s, commit=False)
        db.insert(Tag(id="tag_T1", user_id="user_U1", name="sea words"), session=s, commit=False)
        db.insert(Source(id="src_S1", user_id="user_U1", title="Sea book", source_type="textbook"), session=s, commit=False)
        db.insert(Exercise(id="ex_E1", lesson_id="lesson_L1", exercise_type="true_false", question="sea?", answer="true", content={"statement": "s", "answer": True}), session=s, commit=False)
        db.insert(Exercise(id="ex_E2", lesson_id="lesson_L1", exercise_type="true_false", question="sea draft?", answer="true", content={"statement": "s", "answer": True}, draft=True), session=s, commit=False)
    c = client_for(app, "user_U1")
    assert ("character", "char_C1") in _types(c, "氵") and _types(c, "氵")[("character", "char_C1")]["radical"] is True
    assert _types(c, "海")[("character", "char_C2")]["radical"] is False
    found = _types(c, "sea")
    assert ("tag", "tag_T1") in found and ("source", "src_S1") in found and ("exercise", "ex_E1") in found
    assert ("exercise", "ex_E2") not in found                         # a draft is not searchable
    assert ("lesson", "lesson_L1") in _types(c, "Lesson") and ("language", "lang_L1") in _types(c, "Japan")


def test_shared_lessons_are_found_by_the_collaborator_and_never_by_others(app, db):
    seed(db)
    from lapp.models.system_data import User
    with db.session_scope() as s:
        db.insert(User(id="user_U3", username="u3", email="u3@x.com"), session=s, commit=False)
    assert ("lesson", "lesson_L1") not in _types(client_for(app, "user_U2"), "Lesson")        # not shared yet
    share_lesson()
    assert ("lesson", "lesson_L1") in _types(client_for(app, "user_U2"), "Lesson")
    assert ("vocabulary", "voc_V1") in _types(client_for(app, "user_U2"), "水")
    assert _types(client_for(app, "user_U3"), "Lesson") == {} and _types(client_for(app, "user_U3"), "水") == {}
