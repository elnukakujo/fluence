"""Collaboration sync: full/partial modes + lesson_share."""
import pytest
from sqlalchemy.exc import IntegrityError

from lapp.models.system_data import Collaboration, LessonShare, User
from lapp.models.containers import Language, Lesson
from lapp.services.system_data import LessonShareService


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
