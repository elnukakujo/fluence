"""Lesson-level sharing: same native language, owner-only delete, owner recorded on the share."""
import pytest
from collab_helpers import client_for, seed, share_lesson

from lapp.models.system_data import LessonShare
from lapp.services.system_data import CollaborationService


def test_sharing_needs_a_common_native_language(db):
    seed(db, natives_u2=("fra",))
    with pytest.raises(ValueError, match="native language in common"):
        CollaborationService().invite("user_U1", "user_U2", "lesson", "lesson_L1")


def test_one_language_in_common_is_enough_and_no_preferences_means_english(db):
    seed(db, natives_u2=("fra", "eng"))
    assert CollaborationService().invite("user_U1", "user_U2", "lesson", "lesson_L1").id


def test_the_share_records_its_owner_and_the_lesson_shows_in_the_recipients_course(db):
    seed(db)
    share_lesson()
    with db.session_scope() as s:
        row = s.query(LessonShare).one()
        assert (row.lesson_id, row.user_id, row.owner_id) == ("lesson_L1", "user_U2", "user_U1")
    from lapp.services.system_data import LessonShareService
    shared = LessonShareService().list_shared_lessons("user_U2")
    assert [l["id"] for l in shared] == ["lesson_L1"] and shared[0]["target_iso639_2t"] == "jpn"     # grouped under their own course by ISO


def test_only_the_owner_deletes(app, db):
    seed(db)
    share_lesson()
    assert client_for(app, "user_U2").delete("/api/lessons/lesson_L1").status_code == 403
    assert client_for(app, "user_U2").delete("/api/languages/lang_L1").status_code == 403
    assert client_for(app, "user_U1").delete("/api/lessons/lesson_L1").status_code == 204
