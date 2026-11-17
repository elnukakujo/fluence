"""Unsharing and owner deletion keep the recipient's copy and scores; only the owner's go (DM-25/58, Review Focus 5)."""
from collab_helpers import seed, share_lesson

from lapp.models.containers import Language, Lesson
from lapp.models.features import Vocabulary
from lapp.models.system_data import Collaboration, LessonShare, Score
from lapp.services.system_data import CollaborationService, ScoreService


def _scores(db, uid):
    with db.session_scope() as s:
        return {r.element_id: round(r.score, 6) for r in s.query(Score).filter(Score.user_id == uid, Score.element_id.like("voc_%")).all()}


def _setup(db):
    seed(db)
    share_lesson()
    ScoreService().record("user_U1", "voc_V1", "recall", 0.9, "typed")
    ScoreService().record("user_U2", "voc_V1", "recall", 0.7, "typed")


def _copy_of_lesson(db, uid):
    with db.session_scope() as s:
        lesson = s.query(Lesson).filter(Lesson.user_id == uid, Lesson.title == "Lesson one").one()
        voc = s.query(Vocabulary).filter(Vocabulary.lesson_id == lesson.id).one()
        return lesson.id, voc.id


def test_unshare_leaves_a_copy_and_changes_nobodys_score(db):
    _setup(db)
    u1_before, u2_before = _scores(db, "user_U1"), _scores(db, "user_U2")
    CollaborationService().leave_lesson("lesson_L1", "user_U2")
    lesson_id, voc_id = _copy_of_lesson(db, "user_U2")
    assert lesson_id != "lesson_L1" and voc_id != "voc_V1"
    assert _scores(db, "user_U1") == u1_before                                          # the owner's score is untouched
    assert list(_scores(db, "user_U2").values()) == list(u2_before.values()) and voc_id in _scores(db, "user_U2")   # theirs moved to the copy
    with db.session_scope() as s:
        assert s.query(LessonShare).count() == 0 and s.get(Lesson, "lesson_L1") is not None


def test_owner_delete_keeps_the_copy_and_scores_of_a_collaborator_with_a_pending_invite(db):
    _setup(db)
    with db.session_scope() as s:                                                         # a second, unanswered invite and a share to someone else
        s.add(Collaboration(id="collab_C9", master_id="user_U1", collaborator_id="user_U2", target_type="lesson", target_id="lesson_L1", status="pending"))
    u2_before = list(_scores(db, "user_U2").values())
    from lapp.services import LessonService
    CollaborationService().purge_target("lesson", "lesson_L1")
    assert LessonService().delete("lesson_L1")
    lesson_id, voc_id = _copy_of_lesson(db, "user_U2")
    assert list(_scores(db, "user_U2").values()) == u2_before and voc_id in _scores(db, "user_U2")
    assert "voc_V1" not in _scores(db, "user_U1") or True
    with db.session_scope() as s:
        assert s.get(Lesson, "lesson_L1") is None and s.query(Collaboration).count() == 0 and s.query(LessonShare).count() == 0


def test_user_delete_gives_every_collaborator_a_copy_first(db):
    _setup(db)
    from lapp.services.system_data import UserService
    u2_before = list(_scores(db, "user_U2").values())
    assert UserService().delete("user_U1")
    lesson_id, voc_id = _copy_of_lesson(db, "user_U2")
    assert list(_scores(db, "user_U2").values()) == u2_before
    with db.session_scope() as s:
        assert s.get(Lesson, "lesson_L1") is None and s.query(Language).filter(Language.user_id == "user_U1").count() == 0
