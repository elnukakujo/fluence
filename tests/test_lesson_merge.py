"""Merging two lessons of one language into the first."""
from datetime import datetime

from lapp.models.components import Word
from lapp.models.containers import Language, Lesson
from lapp.models.features import Grammar, Vocabulary
from lapp.models.system_data import LessonShare, Tag, User
from lapp.models.system_data.score import Score
from lapp.services import LessonService
from lapp.services.auth import AuthService
from lapp.services.system_data import ScoreService

svc = LessonService()


def _user(db, uid):
    with db.session_scope() as s:
        db.insert(User(id=uid, username=uid, email=f"{uid}@x.com"), session=s, commit=False)
    return AuthService().create_session(uid, remember=False)


def _setup(app, db):
    token = _user(db, "user_U1")
    _user(db, "user_U2")
    with db.session_scope() as s:
        db.insert(Language(id="lang_L1", user_id="user_U1", name="A"), session=s, commit=False)
        db.insert(Language(id="lang_L2", user_id="user_U1", name="B"), session=s, commit=False)
        db.insert(Tag(id="tag_T1", name="t1", user_id="user_U1"), session=s, commit=False)
        db.insert(Tag(id="tag_T2", name="t2", user_id="user_U1"), session=s, commit=False)
        for i, (lang, pos) in enumerate([("lang_L1", 0), ("lang_L1", 1), ("lang_L1", 2), ("lang_L2", 0)], start=1):
            db.insert(Lesson(id=f"lesson_L{i}", user_id="user_U1", language_id=lang, title=f"T{i}", description=f"d{i}",
                             level=i, position=pos, created_at=datetime(2026, 1, i)), session=s, commit=False)
        db.insert(Word(id="word_W1", language_id="lang_L1", word="水"), session=s, commit=False)
        db.insert(Vocabulary(id="voc_V1", lesson_id="lesson_L1", word_id="word_W1"), session=s, commit=False)
        db.insert(Vocabulary(id="voc_V2", lesson_id="lesson_L2", word_id="word_W1"), session=s, commit=False)  # same word: kept
        db.insert(Grammar(id="gram_G1", lesson_id="lesson_L2", title="g", explanation="e"), session=s, commit=False)
        db.insert(LessonShare(id="share_S1", lesson_id="lesson_L1", user_id="user_U2"), session=s, commit=False)
        db.insert(LessonShare(id="share_S2", lesson_id="lesson_L2", user_id="user_U2"), session=s, commit=False)
    client = app.test_client()
    client.set_cookie('session_token', token)
    return client


def _merge(client, first="lesson_L1", second="lesson_L2", **over):
    body = {"first_id": first, "second_id": second, "title": "Merged", "description": "both", "level": 4, **over}
    return client.post('/api/lessons/merge', json=body)


def test_merge_moves_every_item_keeps_duplicates_and_deletes_the_second(app, db):
    client = _setup(app, db)
    res = _merge(client)
    assert res.status_code == 200
    merged = res.get_json()
    assert (merged["id"], merged["title"], merged["description"], merged["level"]) == ("lesson_L1", "Merged", "both", 4)
    assert sorted(merged["vocabulary"]) == ["voc_V1", "voc_V2"] and merged["grammar"] == ["gram_G1"]
    assert svc.get_by_id("lesson_L2") is None


def test_merge_keeps_the_firsts_shares_and_drops_the_seconds(app, db):
    client = _setup(app, db)
    _merge(client)
    with db.session_scope() as s:
        assert [x.lesson_id for x in s.query(LessonShare).all()] == ["lesson_L1"]


def test_merge_unions_tags(app, db):
    client = _setup(app, db)
    with db.session_scope() as s:
        s.get(Lesson, "lesson_L1").tags = [s.get(Tag, "tag_T1")]
        s.get(Lesson, "lesson_L2").tags = [s.get(Tag, "tag_T2")]
    _merge(client)
    with db.session_scope() as s:
        assert sorted(t.id for t in s.get(Lesson, "lesson_L1").tags) == ["tag_T1", "tag_T2"]


def test_merge_takes_the_earlier_position_and_closes_gaps(app, db):
    client = _setup(app, db)
    _merge(client, first="lesson_L2", second="lesson_L1")        # either order: the merged lesson takes the lower position
    assert [(l["id"], l["position"]) for l in svc.get_all("lang_L1", as_dict=True)] == [("lesson_L2", 0), ("lesson_L3", 1)]


def test_merged_lesson_score_is_recomputed_from_its_items(app, db):
    client = _setup(app, db)
    sc = ScoreService()
    with db.session_scope() as s:
        sc.set("user_U1", "voc_V1", 80.0, 0.5, session=s)
        sc.set("user_U1", "voc_V2", 40.0, 0.5, session=s)
        sc.set("user_U1", "lesson_L1", 99.0, 0.5, session=s)       # stale: must not survive
    _merge(client)
    with db.session_scope() as s:
        assert sc.get_many("user_U1", ["lesson_L1"], session=s)["lesson_L1"].score == round((80 + 40 + 0) / 3, 2)


def test_merge_with_an_empty_second_lesson_works(app, db):
    client = _setup(app, db)
    assert _merge(client, first="lesson_L1", second="lesson_L3").status_code == 200


def test_merge_rejects_bad_input(app, db):
    client = _setup(app, db)
    assert _merge(client, second="lesson_L1").status_code == 400          # itself
    assert _merge(client, second="lesson_L4").status_code == 400          # another language
    assert _merge(client, title="  ").status_code == 400
    assert _merge(client, second="lesson_nope").status_code == 404
    assert svc.get_by_id("lesson_L2") is not None


def test_merge_by_a_non_owner_is_forbidden(app, db):
    _setup(app, db)
    other = app.test_client()
    other.set_cookie('session_token', AuthService().create_session("user_U2", remember=False))
    assert _merge(other).status_code == 403
    assert svc.get_by_id("lesson_L2") is not None


def test_merge_keeps_last_seen_dates_of_lesson_and_language(app, db):
    """A merge recomputes aggregates; it is not a review, so it must not stamp 'seen today'."""
    client = _setup(app, db)
    old = datetime(2026, 1, 5, 12, 0)
    with db.session_scope() as s:
        ScoreService().set("user_U1", "lesson_L1", 10.0, 0.5, session=s)
        ScoreService().set("user_U1", "lang_L1", 10.0, 0.5, session=s)
        for row in s.query(Score).filter(Score.element_id.in_(["lesson_L1", "lang_L1"])):
            row.last_seen_at = old
    assert _merge(client).status_code == 200
    with db.session_scope() as s:
        rows = {r.element_id: r.last_seen_at for r in s.query(Score).filter(Score.element_id.in_(["lesson_L1", "lang_L1"]))}
    assert rows == {"lesson_L1": old, "lang_L1": old}


def test_merge_of_never_reviewed_lessons_leaves_them_never_seen(app, db):
    client = _setup(app, db)
    assert _merge(client).status_code == 200
    with db.session_scope() as s:
        rows = {r.element_id: r.last_seen_at for r in s.query(Score).filter(Score.element_id.in_(["lesson_L1", "lang_L1"]))}
    assert all(v is None for v in rows.values())


def test_score_set_stamps_last_seen_by_default_and_can_skip_it(app, db):
    _setup(app, db)
    sc = ScoreService()
    with db.session_scope() as s:
        assert sc.set("user_U1", "lesson_L3", 5.0, 0.5, session=s).last_seen_at is not None
        assert sc.set("user_U1", "lesson_L4", 5.0, 0.5, touch=False, session=s).last_seen_at is None
