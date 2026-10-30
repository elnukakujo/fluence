"""Collaboration sync: full/partial modes + lesson_share."""
import pytest
from sqlalchemy.exc import IntegrityError

from lapp.models.system_data import Collaboration, LessonShare, User, Tag, Source
from lapp.models.containers import Language, Lesson
from lapp.models.features import Vocabulary
from lapp.models.components import Word
from lapp.services.system_data import LessonShareService, CollaborationService
from lapp.services import LanguageService, LessonService
from lapp.services.auth import AuthService


def _seed_users(db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(User(id="user_U2", username="b", email="b@x.com"), session=s, commit=False)


def test_collaboration_mode_field(db):
    _seed_users(db)
    with db.session_scope() as s:
        db.insert(Collaboration(id="collab_C1", master_id="user_U1", collaborator_id="user_U2",
                                target_type="language", target_id="lang_L1", status="pending",
                                mode="full"), session=s, commit=False)
        s.flush()
        c = s.query(Collaboration).filter(Collaboration.id == "collab_C1").one()
        assert c.mode == "full"


def test_lesson_share_unique_constraint(db):
    _seed_users(db)
    with db.session_scope() as s:
        db.insert(Language(id="lang_L1", user_id="user_U1", name="Japanese",
                           target_iso639_2t="jpn"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="M1"),
                  session=s, commit=False)
        s.flush()
    s = db.get_session()
    try:
        s.add(LessonShare(id="ls_L1", lesson_id="lesson_L1", user_id="user_U2"))
        s.add(LessonShare(id="ls_L2", lesson_id="lesson_L1", user_id="user_U2"))
        with pytest.raises(IntegrityError):
            s.flush()
    finally:
        s.rollback()
        s.close()


def _seed_lesson(db):
    with db.session_scope() as s:
        db.insert(Language(id="lang_L1", user_id="user_U1", name="Japanese",
                           target_iso639_2t="jpn"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="M1"),
                  session=s, commit=False)


def test_share_roundtrip_and_recipient(db):
    _seed_users(db)
    _seed_lesson(db)
    LessonShareService().share("lesson_L1", "user_U2")
    assert LessonShareService().is_recipient("user_U2", "lesson_L1") is True
    assert LessonShareService().list_shared_lesson_ids("user_U2") == ["lesson_L1"]
    assert LessonShareService().unshare("lesson_L1", "user_U2") is True
    assert LessonShareService().is_recipient("user_U2", "lesson_L1") is False


def _client_for_user(app, db, uid):
    token = AuthService().create_session(uid, remember=False)
    client = app.test_client()
    client.set_cookie('session_token', token)
    return client


def _seed_vocab(db):
    with db.session_scope() as s:
        db.insert(Language(id="lang_L1", user_id="user_U1", name="Japanese",
                           target_iso639_2t="jpn", source_iso639_2t="eng"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="M1"),
                  session=s, commit=False)
        db.insert(Word(id="word_W1", language_id="lang_L1", word="水"), session=s, commit=False)
        db.insert(Vocabulary(id="voc_V1", lesson_id="lesson_L1", word_id="word_W1"),
                  session=s, commit=False)


def test_share_recipient_can_write(app, db):
    _seed_users(db)
    _seed_vocab(db)
    LessonShareService().share("lesson_L1", "user_U2")
    res = _client_for_user(app, db, "user_U2").post(
        '/api/vocabulary/score', json={'vocabulary_id': 'voc_V1', 'score': 1.0, 'duration_ms': 100})
    assert res.status_code == 200


def _seed_merge(db):
    with db.session_scope() as s:
        db.insert(Language(id="lang_L1", user_id="user_U1", name="Japanese",
                           target_iso639_2t="jpn", source_iso639_2t="eng"), session=s, commit=False)
        db.insert(Lesson(id="lesson_M1", user_id="user_U1", language_id="lang_L1", title="M1"),
                  session=s, commit=False)
        db.insert(Language(id="lang_U2", user_id="user_U2", name="日本語",
                           target_iso639_2t="jpn", source_iso639_2t="eng"), session=s, commit=False)
        db.insert(Lesson(id="lesson_I1", user_id="user_U2", language_id="lang_U2", title="I1"),
                  session=s, commit=False)


def test_merge_language_combines_and_removes_source(db):
    _seed_users(db)
    _seed_merge(db)
    CollaborationService().merge_language("lang_U2", "lang_L1", "user_U2")
    assert LanguageService().get_by_id("lang_U2") is None
    lessons = LessonService().get_all(language_id="lang_L1", as_dict=True)
    assert {l["title"] for l in lessons} == {"M1", "I1"}


def test_accept_partial_shares_lessons(db):
    _seed_users(db)
    _seed_merge(db)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    CollaborationService().accept(c.id, "partial")
    assert LessonShareService().is_recipient("user_U2", "lesson_M1") is True


def test_accept_full_then_consent_merges(db):
    _seed_users(db)
    _seed_merge(db)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    CollaborationService().accept(c.id, "full")
    with db.session_scope() as s:
        cc = s.query(Collaboration).filter(Collaboration.id == c.id).one()
        assert cc.status == "awaiting_master_consent"
    CollaborationService().consent(c.id)
    assert LanguageService().get_by_id("lang_U2") is None


def test_share_lesson_endpoint(app, db):
    _seed_users(db)
    _seed_lesson(db)
    with db.session_scope() as s:  # sharing requires an accepted partial collaboration
        db.insert(Collaboration(id="collab_C1", master_id="user_U1", collaborator_id="user_U2",
                                target_type="language", target_id="lang_L1", status="accepted",
                                mode="partial"), session=s, commit=False)
    res = _client_for_user(app, db, "user_U1").post('/api/lessons/lesson_L1/share', json={'user_id': 'user_U2'})
    assert res.status_code == 200
    assert LessonShareService().is_recipient("user_U2", "lesson_L1") is True
    res = _client_for_user(app, db, "user_U1").delete('/api/lessons/lesson_L1/share', json={'user_id': 'user_U2'})
    assert res.status_code == 200
    assert LessonShareService().is_recipient("user_U2", "lesson_L1") is False


def test_accept_route_persists_mode(app, db):
    _seed_users(db)
    _seed_merge(db)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    res = _client_for_user(app, db, "user_U2").post(f'/api/collaboration/{c.id}/accept', json={'mode': 'partial'})
    assert res.status_code == 200
    with db.session_scope() as s:
        cc = s.query(Collaboration).filter(Collaboration.id == c.id).one()
        assert cc.mode == 'partial'


def test_list_awaiting_consent(db):
    _seed_users(db)
    _seed_merge(db)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    CollaborationService().accept(c.id, "full")
    pending = CollaborationService().list_awaiting_consent("user_U1")
    assert any(x["id"] == c.id for x in pending)


def test_partial_collaborator_no_language_write(db):
    from lapp.core.auth import can_write
    _seed_users(db)
    _seed_merge(db)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    CollaborationService().accept(c.id, "partial")
    assert can_write("user_U2", "lang_L1") is False       # partial: no language write
    assert can_write("user_U2", "lesson_M1") is True      # shared lesson still writable


def test_collision_requires_source_and_target_iso(db):
    _seed_users(db)
    # master eng->jpn (lang_L1); invitee fra->jpn (lang_U2, different source)
    with db.session_scope() as s:
        db.insert(Language(id="lang_L1", user_id="user_U1", name="Japanese",
                           target_iso639_2t="jpn", source_iso639_2t="eng"), session=s, commit=False)
        db.insert(Language(id="lang_U2", user_id="user_U2", name="Japonais",
                           target_iso639_2t="jpn", source_iso639_2t="fra"), session=s, commit=False)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    CollaborationService().accept(c.id, "full")
    CollaborationService().consent(c.id)
    # different source ISO → NOT a collision → lang_U2 must survive (no merge)
    assert LanguageService().get_by_id("lang_U2") is not None


def test_no_collision_accepts_immediately(db):
    _seed_users(db)
    with db.session_scope() as s:
        db.insert(Language(id="lang_L1", user_id="user_U1", name="Japanese",
                           target_iso639_2t="jpn", source_iso639_2t="eng"), session=s, commit=False)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    CollaborationService().accept(c.id, "full")
    with db.session_scope() as s:
        cc = s.query(Collaboration).filter(Collaboration.id == c.id).one()
        assert cc.status == "accepted"  # no collision → immediately accepted


def test_partial_does_not_list_master_language(db):
    _seed_users(db)
    _seed_merge(db)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    CollaborationService().accept(c.id, "partial")
    collab_ids = CollaborationService().list_collaborated_target_ids("user_U2", "language")
    assert "lang_L1" not in collab_ids  # partial shares lessons, not the language


def test_list_shared_lessons(db):
    _seed_users(db)
    _seed_merge(db)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    CollaborationService().accept(c.id, "partial")
    shared = LessonShareService().list_shared_lessons("user_U2")
    assert any(l["id"] == "lesson_M1" for l in shared)


def test_leave_shared_lesson(app, db):
    _seed_users(db)
    _seed_lesson(db)
    LessonShareService().share("lesson_L1", "user_U2")
    res = _client_for_user(app, db, "user_U2").delete('/api/lessons/lesson_L1/leave')
    assert res.status_code == 200
    assert LessonShareService().is_recipient("user_U2", "lesson_L1") is False


def test_accept_partial_shares_selected_lessons(db):
    _seed_users(db)
    with db.session_scope() as s:
        db.insert(Language(id="lang_L1", user_id="user_U1", name="Japanese",
                           target_iso639_2t="jpn", source_iso639_2t="eng"), session=s, commit=False)
        db.insert(Lesson(id="lesson_M1", user_id="user_U1", language_id="lang_L1", title="M1"),
                  session=s, commit=False)
        db.insert(Lesson(id="lesson_M2", user_id="user_U1", language_id="lang_L1", title="M2"),
                  session=s, commit=False)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    CollaborationService().accept(c.id, "partial", lesson_ids=["lesson_M1"])
    assert LessonShareService().is_recipient("user_U2", "lesson_M1") is True
    assert LessonShareService().is_recipient("user_U2", "lesson_M2") is False


def test_partial_accept_replicates_language_when_no_iso_match(db):
    """Invitee with no matching-ISO language gets a one-time copy of the master's
    language metadata (iso/title/created_at/tags/sources), and the chosen lessons
    stay shared pointers."""
    from datetime import datetime
    _seed_users(db)
    with db.session_scope() as s:
        lang = Language(id="lang_L1", user_id="user_U1", name="Chinese", alias="中文",
                        flag="🇨🇳", level=0, description="Beginner Mandarin",
                        source_iso639_2t="eng", target_iso639_2t="chi",
                        created_at=datetime(2024, 1, 1))
        db.insert(lang, session=s, commit=False)
        tag = Tag(id="tag_T1", user_id="user_U1", name="HSK1", color="#f43f5e")
        src = Source(id="src_S1", user_id="user_U1", title="HSK Standard Course",
                     source_type="textbook")
        db.insert(tag, session=s, commit=False)
        db.insert(src, session=s, commit=False)
        db.insert(Lesson(id="lesson_M1", user_id="user_U1", language_id="lang_L1", title="M1"),
                  session=s, commit=False)
        s.flush()
        lang.tags.append(tag)
        lang.sources.append(src)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    CollaborationService().accept(c.id, "partial", lesson_ids=["lesson_M1"])

    with db.session_scope() as s:
        copy = s.query(Language).filter(
            Language.user_id == "user_U2", Language.target_iso639_2t == "chi").one()
        assert copy.name == "Chinese"
        assert copy.alias == "中文"
        assert copy.created_at == datetime(2024, 1, 1)
        # tags/sources are invitee-owned copies, not links to the master's
        assert [t.name for t in copy.tags] == ["HSK1"]
        assert copy.tags[0].user_id == "user_U2"
        assert [s.title for s in copy.sources] == ["HSK Standard Course"]
        assert copy.sources[0].user_id == "user_U2"
        # no lessons copied — only the shared pointer exists
        assert s.query(Lesson).filter(Lesson.language_id == copy.id).count() == 0
    assert LessonShareService().is_recipient("user_U2", "lesson_M1") is True


def test_ensure_shared_hosts_heals_orphaned_shares(db):
    """A share left without a host language (stale accepted collab) gets one on listing."""
    _seed_users(db)
    with db.session_scope() as s:
        db.insert(Language(id="lang_L1", user_id="user_U1", name="Chinese",
                           source_iso639_2t="eng", target_iso639_2t="chi"), session=s, commit=False)
        db.insert(Lesson(id="lesson_M1", user_id="user_U1", language_id="lang_L1", title="M1"),
                  session=s, commit=False)
        s.flush()
        s.add(LessonShare(id="lshare_1", lesson_id="lesson_M1", user_id="user_U2"))
    CollaborationService().ensure_shared_hosts("user_U2")
    CollaborationService().ensure_shared_hosts("user_U2")  # idempotent
    with db.session_scope() as s:
        assert s.query(Language).filter(
            Language.user_id == "user_U2", Language.target_iso639_2t == "chi").count() == 1


def test_remove_partial_unshares_not_forks(db):
    _seed_users(db)
    with db.session_scope() as s:
        db.insert(Language(id="lang_L1", user_id="user_U1", name="Japanese",
                           target_iso639_2t="jpn", source_iso639_2t="eng"), session=s, commit=False)
        db.insert(Lesson(id="lesson_M1", user_id="user_U1", language_id="lang_L1", title="M1"),
                  session=s, commit=False)
        # invitee's own language with one lesson
        db.insert(Language(id="lang_U2", user_id="user_U2", name="Japanese",
                           target_iso639_2t="jpn", source_iso639_2t="eng"), session=s, commit=False)
        db.insert(Lesson(id="lesson_I1", user_id="user_U2", language_id="lang_U2", title="I1"),
                  session=s, commit=False)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    CollaborationService().accept(c.id, "partial", lesson_ids=["lesson_M1"])
    CollaborationService().remove(c.id)
    # M1 is unshared, and no copy of it landed in the invitee's language
    assert LessonShareService().is_recipient("user_U2", "lesson_M1") is False
    titles = [l.title for l in LessonService().get_all(language_id="lang_U2")]
    assert titles == ["I1"]


def _collab_rows(db):
    with db.session_scope() as s:
        return s.query(Collaboration).filter(Collaboration.collaborator_id == "user_U2").count()


def test_leave_last_lesson_ends_collaboration(db):
    _seed_users(db)
    with db.session_scope() as s:
        db.insert(Language(id="lang_L1", user_id="user_U1", name="Japanese",
                           target_iso639_2t="jpn", source_iso639_2t="eng"), session=s, commit=False)
        db.insert(Lesson(id="lesson_M1", user_id="user_U1", language_id="lang_L1", title="M1"),
                  session=s, commit=False)
        db.insert(Lesson(id="lesson_M2", user_id="user_U1", language_id="lang_L1", title="M2"),
                  session=s, commit=False)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    CollaborationService().accept(c.id, "partial", lesson_ids=["lesson_M1", "lesson_M2"])

    # leaving one lesson keeps the collaboration (still shares M2)
    CollaborationService().leave_lesson("lesson_M1", "user_U2")
    assert _collab_rows(db) == 1  # partial invitees are hidden from list_collaborators, so check rows

    # leaving the last lesson ends the collaboration so the master can re-invite
    CollaborationService().leave_lesson("lesson_M2", "user_U2")
    assert _collab_rows(db) == 0


# --- review fixes -----------------------------------------------------------

def _langs(db, uid):
    with db.session_scope() as s:
        return s.query(Language).filter(Language.user_id == uid).count()


def test_remove_pending_invite_does_not_fork(db):
    _seed_users(db)
    _seed_lesson(db)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    CollaborationService().remove(c.id)
    assert _langs(db, "user_U2") == 0


def test_accept_only_applies_to_pending(db):
    _seed_users(db)
    _seed_merge(db)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    CollaborationService().accept(c.id, "full")  # collision -> awaiting consent
    CollaborationService().accept(c.id, None)    # must not bypass consent
    with db.session_scope() as s:
        cc = s.query(Collaboration).filter(Collaboration.id == c.id).one()
        assert (cc.status, cc.mode) == ("awaiting_master_consent", "full")


def test_accept_route_rejects_non_pending(app, db):
    _seed_users(db)
    _seed_merge(db)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    cl = _client_for_user(app, db, "user_U2")
    assert cl.post(f'/api/collaboration/{c.id}/accept', json={'mode': 'partial'}).status_code == 200
    assert cl.post(f'/api/collaboration/{c.id}/accept', json={'mode': 'partial'}).status_code == 403


def test_invite_route_rejects_self_and_missing_fields(app, db):
    _seed_users(db)
    _seed_lesson(db)
    cl = _client_for_user(app, db, "user_U1")
    base = {'target_type': 'language', 'target_id': 'lang_L1'}
    assert cl.post('/api/collaboration', json={**base, 'collaborator_id': 'user_U1'}).status_code == 400
    assert cl.post('/api/collaboration', json={'target_type': 'language'}).status_code == 400
    assert cl.post('/api/collaboration', json=base).status_code == 400


def test_merge_language_into_itself_is_noop(db):
    _seed_users(db)
    _seed_lesson(db)
    CollaborationService().merge_language("lang_L1", "lang_L1", "user_U1")
    assert LanguageService().get_by_id("lang_L1") is not None


def test_leave_lesson_keeps_full_collaboration(db):
    _seed_users(db)
    _seed_lesson(db)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    CollaborationService().accept(c.id, "full")  # no collision -> accepted
    CollaborationService().leave_lesson("lesson_L1", "user_U2")
    assert _collab_rows(db) == 1  # partial invitees are hidden from list_collaborators, so check rows


def test_list_payloads_carry_display_fields(db):
    _seed_users(db)
    _seed_merge(db)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    CollaborationService().accept(c.id, "full")  # collision -> awaiting consent
    listed = CollaborationService().list_collaborators("language", "lang_L1")
    assert listed[0]["mode"] == "full"
    req = CollaborationService().list_awaiting_consent("user_U1")[0]
    assert req["collaborator_name"] == "b" and req["language_name"] == "Japanese"


def test_master_declines_merge_request(app, db):
    _seed_users(db)
    _seed_merge(db)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    CollaborationService().accept(c.id, "full")  # collision -> awaiting consent
    # only the master may decline, and only while awaiting consent
    assert _client_for_user(app, db, "user_U2").post(f'/api/collaboration/{c.id}/decline').status_code == 403
    assert _client_for_user(app, db, "user_U1").post(f'/api/collaboration/{c.id}/decline').status_code == 200
    assert CollaborationService().list_awaiting_consent("user_U1") == []
    assert LanguageService().get_by_id("lang_U2") is not None  # invitee's language untouched
    assert _client_for_user(app, db, "user_U1").post(f'/api/collaboration/{c.id}/decline').status_code == 404


# ---- flaw-fix tests (docs/superpowers/plans/2026-10-30-collaboration-flaw-fixes.md) ----

def test_partial_accept_replicates_despite_name_collision(db):
    _seed_users(db)
    with db.session_scope() as s:
        db.insert(Language(id="lang_L1", user_id="user_U1", name="Chinese",
                           source_iso639_2t="eng", target_iso639_2t="chi"), session=s, commit=False)
        db.insert(Lesson(id="lesson_M1", user_id="user_U1", language_id="lang_L1", title="M1"),
                  session=s, commit=False)
        db.insert(Language(id="lang_U2", user_id="user_U2", name="Chinese",
                           source_iso639_2t="eng", target_iso639_2t="jpn"), session=s, commit=False)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    CollaborationService().accept(c.id, "partial", lesson_ids=["lesson_M1"])
    with db.session_scope() as s:
        names = {l.target_iso639_2t: l.name for l in s.query(Language).filter(Language.user_id == "user_U2")}
        assert names == {"jpn": "Chinese", "chi": "Chinese (chi)"}


def test_merge_language_merges_tags_and_sources(db):
    _seed_users(db)
    _seed_merge(db)
    with db.session_scope() as s:
        t1 = Tag(id="tag_1", user_id="user_U2", name="HSK1", color="#111")
        t2 = Tag(id="tag_2", user_id="user_U2", name="shared", color="#222")
        t3 = Tag(id="tag_3", user_id="user_U1", name="shared", color="#222")
        src = Source(id="src_1", user_id="user_U2", title="Book A", source_type="textbook")
        for o in (t1, t2, t3, src):
            db.insert(o, session=s, commit=False)
        s.flush()
        src_lang, dst_lang = s.get(Language, "lang_U2"), s.get(Language, "lang_L1")
        src_lang.tags.extend([t1, t2])
        src_lang.sources.append(src)
        dst_lang.tags.append(t3)
    CollaborationService().merge_language("lang_U2", "lang_L1", "user_U2")
    with db.session_scope() as s:
        tgt = s.get(Language, "lang_L1")
        assert sorted(t.name for t in tgt.tags) == ["HSK1", "shared"]
        assert all(t.user_id == "user_U1" for t in tgt.tags)
        assert [x.title for x in tgt.sources] == ["Book A"]
        assert tgt.sources[0].user_id == "user_U1"


def test_merge_remaps_current_lesson_id_and_language_score(db):
    from lapp.models.system_data import Score
    _seed_users(db)
    _seed_merge(db)
    with db.session_scope() as s:
        s.add(Score(id="score_1", user_id="user_U2", element_id="lang_U2",
                    current_lesson_id="lesson_I1"))
    CollaborationService().merge_language("lang_U2", "lang_L1", "user_U2")
    with db.session_scope() as s:
        sc = s.query(Score).filter(Score.user_id == "user_U2").one()
        assert sc.element_id == "lang_L1"
        new = s.query(Lesson).filter(Lesson.language_id == "lang_L1", Lesson.title == "I1").one()
        assert sc.current_lesson_id == new.id


def test_merge_score_collision_keeps_destination_row(db):
    from lapp.models.system_data import Score
    _seed_users(db)
    _seed_merge(db)
    with db.session_scope() as s:
        db.insert(Word(id="word_dst", language_id="lang_L1", word="水"), session=s, commit=False)
        db.insert(Word(id="word_src", language_id="lang_U2", word="水"), session=s, commit=False)
        s.add(Score(id="score_d", user_id="user_U2", element_id="word_dst", score=0.2))
        s.add(Score(id="score_s", user_id="user_U2", element_id="word_src", score=0.9))
    CollaborationService().merge_language("lang_U2", "lang_L1", "user_U2")
    with db.session_scope() as s:
        rows = s.query(Score).filter(Score.user_id == "user_U2", Score.element_id == "word_dst").all()
        assert [r.score for r in rows] == [0.2]


def test_fork_remaps_current_lesson_id(db):
    from lapp.models.system_data import Score
    _seed_users(db)
    _seed_merge(db)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    CollaborationService().accept(c.id)  # legacy full link, no collision flow
    with db.session_scope() as s:
        s.add(Score(id="score_1", user_id="user_U2", element_id="lang_L1",
                    current_lesson_id="lesson_M1"))
    CollaborationService().remove(c.id)
    with db.session_scope() as s:
        sc = s.query(Score).filter(Score.user_id == "user_U2").one()
        assert sc.element_id == "lang_U2"  # deduped into the invitee's jpn language
        new = s.query(Lesson).filter(Lesson.language_id == "lang_U2", Lesson.title == "M1").one()
        assert sc.current_lesson_id == new.id


def test_accept_partial_empty_lesson_ids_is_400(app, db):
    _seed_users(db)
    _seed_merge(db)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    cl = _client_for_user(app, db, "user_U2")
    assert cl.post(f'/api/collaboration/{c.id}/accept',
                   json={'mode': 'partial', 'lesson_ids': []}).status_code == 400
    with db.session_scope() as s:
        assert s.query(Collaboration).filter(Collaboration.id == c.id).one().status == "pending"


def test_has_collision_is_directional(db):
    _seed_users(db)
    with db.session_scope() as s:
        db.insert(Language(id="lang_L1", user_id="user_U1", name="Japanese",
                           source_iso639_2t="eng", target_iso639_2t="jpn"), session=s, commit=False)
        db.insert(Language(id="lang_U2", user_id="user_U2", name="English",
                           source_iso639_2t="jpn", target_iso639_2t="eng"), session=s, commit=False)
    with db.session_scope() as s:
        assert CollaborationService()._has_collision("user_U2", "lang_L1", s) is False


def test_full_consent_merge_remove_roundtrip(db):
    from lapp.models.system_data import Score
    _seed_users(db)
    _seed_merge(db)
    with db.session_scope() as s:
        db.insert(Word(id="word_i", language_id="lang_U2", word="火"), session=s, commit=False)
        db.insert(Vocabulary(id="voc_i", lesson_id="lesson_I1", word_id="word_i"), session=s, commit=False)
        s.add(Score(id="score_v", user_id="user_U2", element_id="voc_i", score=0.7))
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    CollaborationService().accept(c.id, "full")
    CollaborationService().consent(c.id)
    assert LanguageService().get_by_id("lang_U2") is None
    CollaborationService().remove(c.id)
    with db.session_scope() as s:
        lang = s.query(Language).filter(Language.user_id == "user_U2").one()
        titles = {l.title for l in s.query(Lesson).filter(Lesson.language_id == lang.id)}
        assert titles == {"M1", "I1"}
        new_voc = s.query(Vocabulary).join(Lesson).filter(
            Lesson.language_id == lang.id, Lesson.title == "I1").one()
        sc = s.query(Score).filter(Score.user_id == "user_U2", Score.score == 0.7).one()
        assert sc.element_id == new_voc.id


def test_replication_reuses_owned_tag(db):
    _seed_users(db)
    with db.session_scope() as s:
        db.insert(Language(id="lang_L1", user_id="user_U1", name="Chinese",
                           source_iso639_2t="eng", target_iso639_2t="chi"), session=s, commit=False)
        db.insert(Lesson(id="lesson_M1", user_id="user_U1", language_id="lang_L1", title="M1"),
                  session=s, commit=False)
        mt = Tag(id="tag_m", user_id="user_U1", name="HSK1", color="#111")
        ot = Tag(id="tag_o", user_id="user_U2", name="HSK1", color="#222")
        db.insert(mt, session=s, commit=False); db.insert(ot, session=s, commit=False)
        s.flush()
        master_lang = s.get(Language, "lang_L1")
        master_lang.tags.append(mt)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    CollaborationService().accept(c.id, "partial", lesson_ids=["lesson_M1"])
    with db.session_scope() as s:
        assert s.query(Tag).filter(Tag.user_id == "user_U2", Tag.name == "HSK1").count() == 1
        lang = s.query(Language).filter(Language.user_id == "user_U2").one()
        assert [t.id for t in lang.tags] == ["tag_o"]


def test_partial_remove_leaves_no_orphan_shares(db):
    _seed_users(db)
    _seed_merge(db)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    CollaborationService().accept(c.id, "partial")
    CollaborationService().remove(c.id)
    with db.session_scope() as s:
        assert s.query(LessonShare).filter(LessonShare.user_id == "user_U2").count() == 0


# ---- offer modes (docs/superpowers/plans/2026-10-30-collaboration-offer-modes-backend.md) ----

def test_collaboration_offer_columns(db):
    _seed_users(db)
    with db.session_scope() as s:
        db.insert(Collaboration(id="collab_C1", master_id="user_U1", collaborator_id="user_U2",
                                target_type="language", target_id="lang_L1", status="pending",
                                proposed_mode="partial", offered_lesson_ids=["lesson_M1"]),
                  session=s, commit=False)
    with db.session_scope() as s:
        c = s.query(Collaboration).one()
        assert c.proposed_mode == "partial" and c.offered_lesson_ids == ["lesson_M1"]


def test_deleting_shared_lesson_cascades_share(db):
    _seed_users(db)
    _seed_merge(db)
    LessonShareService().share("lesson_M1", "user_U2")
    with db.session_scope() as s:
        s.delete(s.get(Lesson, "lesson_M1"))
    with db.session_scope() as s:
        assert s.query(LessonShare).count() == 0


def _invite_post(app, db, **body):
    return _client_for_user(app, db, "user_U1").post('/api/collaboration/', json={
        'target_type': 'language', 'target_id': 'lang_L1', 'collaborator_id': 'user_U2', **body})


def test_invite_partial_stores_offer(app, db):
    _seed_users(db); _seed_merge(db)
    res = _invite_post(app, db, mode='partial', lesson_ids=['lesson_M1'])
    assert res.status_code == 200
    with db.session_scope() as s:
        c = s.query(Collaboration).one()
        assert c.proposed_mode == "partial" and c.offered_lesson_ids == ["lesson_M1"]


def test_invite_partial_requires_lessons_of_that_language(app, db):
    _seed_users(db); _seed_merge(db)
    assert _invite_post(app, db, mode='partial', lesson_ids=[]).status_code == 400
    assert _invite_post(app, db, mode='partial', lesson_ids=['lesson_I1']).status_code == 400  # other language
    assert _invite_post(app, db, mode='partial').status_code == 400


def test_invite_lesson_target_rejects_mode(app, db):
    _seed_users(db); _seed_merge(db)
    res = _client_for_user(app, db, "user_U1").post('/api/collaboration/', json={
        'target_type': 'lesson', 'target_id': 'lesson_M1', 'collaborator_id': 'user_U2', 'mode': 'partial'})
    assert res.status_code == 400


def test_invite_rejects_invalid_mode_but_allows_legacy_none(app, db):
    _seed_users(db); _seed_merge(db)
    assert _invite_post(app, db, mode='x').status_code == 400
    assert _invite_post(app, db).status_code == 200


def _partial_offer(db, offered):
    _seed_users(db); _seed_merge(db)
    with db.session_scope() as s:
        db.insert(Lesson(id="lesson_M2", user_id="user_U1", language_id="lang_L1", title="M2"),
                  session=s, commit=False)
    return CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1",
                                         mode="partial", lesson_ids=offered)


def _accept_post(app, db, c, **body):
    return _client_for_user(app, db, "user_U2").post(f'/api/collaboration/{c.id}/accept', json=body)


def _assert_untouched(db, c):
    with db.session_scope() as s:
        assert s.get(Collaboration, c.id).status == "pending"
        assert s.query(LessonShare).count() == 0
        assert s.query(Language).filter(Language.user_id == "user_U2").count() == 1  # only lang_U2


def test_accept_partial_offer_rejects_full_mode(app, db):
    c = _partial_offer(db, ["lesson_M1"])
    assert _accept_post(app, db, c, mode="full").status_code == 400
    _assert_untouched(db, c)


def test_accept_partial_offer_rejects_ids_outside_offer(app, db):
    c = _partial_offer(db, ["lesson_M1"])
    assert _accept_post(app, db, c, mode="partial", lesson_ids=["lesson_M2"]).status_code == 400
    _assert_untouched(db, c)


def test_accept_partial_offer_defaults_to_all_offered(app, db):
    c = _partial_offer(db, ["lesson_M1"])
    assert _accept_post(app, db, c, mode="partial").status_code == 200
    assert LessonShareService().is_recipient("user_U2", "lesson_M1")
    assert not LessonShareService().is_recipient("user_U2", "lesson_M2")


def test_accept_partial_offer_skips_deleted_lessons(app, db):
    c = _partial_offer(db, ["lesson_M1", "lesson_M2"])
    with db.session_scope() as s:
        s.delete(s.get(Lesson, "lesson_M2"))
    assert _accept_post(app, db, c, mode="partial").status_code == 200
    with db.session_scope() as s:
        assert [x.lesson_id for x in s.query(LessonShare)] == ["lesson_M1"]


def test_accept_partial_offer_all_deleted_is_409(app, db):
    c = _partial_offer(db, ["lesson_M2"])
    with db.session_scope() as s:
        s.delete(s.get(Lesson, "lesson_M2"))
    assert _accept_post(app, db, c, mode="partial").status_code == 409
    _assert_untouched(db, c)


def test_accept_full_offer_allows_partial_over_all_lessons(app, db):
    _seed_users(db); _seed_merge(db)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1", mode="full")
    assert _accept_post(app, db, c, mode="partial").status_code == 200
    assert LessonShareService().is_recipient("user_U2", "lesson_M1")


def test_replicate_matches_iso_couple_not_target_only(db):
    _seed_users(db); _seed_merge(db)
    with db.session_scope() as s:
        s.get(Language, "lang_U2").source_iso639_2t = "fra"   # fra->jpn vs master eng->jpn
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    CollaborationService().accept(c.id, "partial")
    with db.session_scope() as s:
        langs = s.query(Language).filter(Language.user_id == "user_U2", Language.target_iso639_2t == "jpn").all()
        assert sorted(l.source_iso639_2t for l in langs) == ["eng", "fra"]


def _lesson_invite(db):
    _seed_users(db); _seed_merge(db)
    return CollaborationService().invite("user_U1", "user_U2", "lesson", "lesson_M1")


def test_lesson_invite_accept_creates_share_and_host(db):
    c = _lesson_invite(db)
    with db.session_scope() as s:
        s.delete(s.get(Language, "lang_U2"))          # invitee has no matching language
    assert CollaborationService().accept(c.id) is None
    assert LessonShareService().is_recipient("user_U2", "lesson_M1")
    with db.session_scope() as s:
        assert s.query(Collaboration).count() == 0
        assert s.query(Language).filter(Language.user_id == "user_U2", Language.target_iso639_2t == "jpn").count() == 1


def test_lesson_invite_accept_reuses_matching_language(db):
    c = _lesson_invite(db)
    CollaborationService().accept(c.id)
    with db.session_scope() as s:
        assert [l.id for l in s.query(Language).filter(Language.user_id == "user_U2")] == ["lang_U2"]


def test_lesson_invite_accept_twice_safe(db):
    c = _lesson_invite(db)
    LessonShareService().share("lesson_M1", "user_U2")   # already holds the share
    CollaborationService().accept(c.id)
    with db.session_scope() as s:
        assert s.query(LessonShare).count() == 1


def test_language_collaborators_exclude_partial(db):
    _seed_users(db); _seed_merge(db)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    CollaborationService().accept(c.id, "partial")
    with db.session_scope() as s:
        d = s.get(Language, "lang_L1").to_dict()
        assert d["collaborators"] == [] and d["partial_collaborators"] == ["b"]


def test_lesson_collaborators_come_from_lesson_share(db):
    _seed_users(db); _seed_merge(db)
    LessonShareService().share("lesson_M1", "user_U2")
    with db.session_scope() as s:
        assert s.get(Lesson, "lesson_M1").to_dict()["collaborators"] == ["b"]


def test_list_collaborators_hides_accepted_partial_keeps_pending(db):
    _seed_users(db); _seed_merge(db)
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    assert [x["status"] for x in CollaborationService().list_collaborators("language", "lang_L1")] == ["pending"]
    CollaborationService().accept(c.id, "partial")
    assert CollaborationService().list_collaborators("language", "lang_L1") == []


def test_list_invites_carries_offer(db):
    c = _partial_offer(db, ["lesson_M1", "lesson_M2"])
    with db.session_scope() as s:
        s.delete(s.get(Lesson, "lesson_M2"))
    inv = CollaborationService().list_invites("user_U2")[0]
    assert inv["proposed_mode"] == "partial"
    assert [l["id"] for l in inv["lessons"]] == ["lesson_M1"]


def test_lesson_collaborators_route_owner_only(app, db):
    _seed_users(db); _seed_merge(db)
    LessonShareService().share("lesson_M1", "user_U2")
    res = _client_for_user(app, db, "user_U1").get('/api/lessons/lesson_M1/collaborators')
    assert res.status_code == 200 and res.get_json() == [{"user_id": "user_U2", "name": "b"}]
    assert _client_for_user(app, db, "user_U2").get('/api/lessons/lesson_M1/collaborators').status_code in (403, 404)


def test_share_lesson_requires_accepted_partial_collaboration(app, db):
    _seed_users(db); _seed_merge(db)
    cl = _client_for_user(app, db, "user_U1")
    assert cl.post('/api/lessons/lesson_M1/share', json={'user_id': 'user_U2'}).status_code == 403
    with db.session_scope() as s:
        assert s.query(LessonShare).count() == 0
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    assert cl.post('/api/lessons/lesson_M1/share', json={'user_id': 'user_U2'}).status_code == 403  # pending
    CollaborationService().accept(c.id, "partial", lesson_ids=[])  # service-level: shares nothing
    assert cl.post('/api/lessons/lesson_M1/share', json={'user_id': 'user_U2'}).status_code == 200
    assert LessonShareService().is_recipient("user_U2", "lesson_M1")


def test_user_list_search_matches_name_username_email_returns_only_display(app, db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="me", email="me@x.com"), session=s, commit=False)
        db.insert(User(id="user_U2", username="bob", email="bob@mail.org", display_name="Robert"),
                  session=s, commit=False)
        db.insert(User(id="user_U3", username="amy", email="amy@x.com"), session=s, commit=False)
    cl = _client_for_user(app, db, "user_U1")
    get = lambda q: cl.get(f'/api/user/list?q={q}').get_json()
    assert get("robert") == [{"id": "user_U2", "display_name": "Robert"}]   # display name
    assert [u["id"] for u in get("bob")] == ["user_U2"]                      # username
    assert [u["id"] for u in get("mail.org")] == ["user_U2"]                 # email, never returned
    assert {u["id"] for u in get("")} == {"user_U2", "user_U3"}              # caller excluded
    assert get("zzz") == []


def test_partial_invitee_can_be_offered_more_lessons(db):
    c = _partial_offer(db, ["lesson_M1"])
    CollaborationService().accept(c.id, "partial")
    # the second offer used to be swallowed (idempotent invite returned the accepted row)
    again = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1",
                                          mode="partial", lesson_ids=["lesson_M1", "lesson_M2"])
    assert again.id == c.id
    with db.session_scope() as s:
        pending = s.query(Collaboration).filter(Collaboration.status == "pending").all()
        assert [(p.target_type, p.target_id) for p in pending] == [("lesson", "lesson_M2")]  # M1 already shared
    lesson_invite = CollaborationService().list_invites("user_U2")[0]
    assert lesson_invite["target_type"] == "lesson"
    CollaborationService().accept(lesson_invite["id"])
    assert LessonShareService().is_recipient("user_U2", "lesson_M2")


def test_reinviting_with_nothing_new_or_full_is_rejected_not_swallowed(db):
    c = _partial_offer(db, ["lesson_M1"])
    CollaborationService().accept(c.id, "partial")
    with pytest.raises(ValueError):
        CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1",
                                      mode="partial", lesson_ids=["lesson_M1"])
    with pytest.raises(ValueError):
        CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1", mode="full")


def test_new_offer_replaces_pending_offer(db):
    c = _partial_offer(db, ["lesson_M1"])
    CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1",
                                  mode="partial", lesson_ids=["lesson_M2"])
    with db.session_scope() as s:
        assert s.get(Collaboration, c.id).offered_lesson_ids == ["lesson_M2"]


def test_invitee_languages_report_shared_lesson_count(app, db):
    c = _partial_offer(db, ["lesson_M1", "lesson_M2"])
    CollaborationService().accept(c.id, "partial")   # invitee already has lang_U2 (same couple)
    langs = _client_for_user(app, db, "user_U2").get('/api/languages/all/user_U2').get_json()
    mine = [l for l in langs if l["user_id"] == "user_U2"]
    assert [l["shared_lesson_count"] for l in mine] == [2]


def test_master_unsharing_last_lesson_ends_collaboration_so_full_can_be_offered(app, db):
    c = _partial_offer(db, ["lesson_M1"])
    CollaborationService().accept(c.id, "partial")
    res = _client_for_user(app, db, "user_U1").delete('/api/lessons/lesson_M1/share', json={'user_id': 'user_U2'})
    assert res.status_code == 200
    assert _collab_rows(db) == 0
    CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1", mode="full")  # no longer blocked


def test_deleting_language_or_lesson_purges_collaborations(app, db):
    _seed_users(db); _seed_merge(db)
    CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    CollaborationService().invite("user_U1", "user_U2", "lesson", "lesson_M1")
    cl = _client_for_user(app, db, "user_U1")
    cl.delete('/api/lessons/lesson_M1')
    with db.session_scope() as s:
        assert [(c.target_type) for c in s.query(Collaboration)] == ["language"]
    cl.delete('/api/languages/lang_L1')
    with db.session_scope() as s:
        assert s.query(Collaboration).count() == 0


def test_lesson_invite_payload_names_the_lesson(db):
    _seed_users(db); _seed_merge(db)
    CollaborationService().invite("user_U1", "user_U2", "lesson", "lesson_M1")
    assert CollaborationService().list_invites("user_U2")[0]["lesson_title"] == "M1"


def test_create_lesson_is_owned_by_the_language_owner(app, db):
    _seed_users(db); _seed_merge(db)
    own = _client_for_user(app, db, "user_U2").post(
        '/api/lessons/', json={'language_id': 'lang_U2', 'title': 'mine'})
    assert own.status_code == 201 and own.get_json()['lesson']['user_id'] == "user_U2"
    c = CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")
    CollaborationService().accept(c.id)  # legacy full link: collaborator may write
    shared = _client_for_user(app, db, "user_U2").post(
        '/api/lessons/', json={'language_id': 'lang_L1', 'title': 'added'})
    assert shared.status_code == 201 and shared.get_json()['lesson']['user_id'] == "user_U1"
