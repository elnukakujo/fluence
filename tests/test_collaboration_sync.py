"""Collaboration sync: full/partial modes + lesson_share."""
import pytest
from sqlalchemy.exc import IntegrityError

from lapp.models.system_data import Collaboration, LessonShare, User
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
