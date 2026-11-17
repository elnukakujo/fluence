"""Seeds shared by the collaboration tests: an owner (U1) with a lesson holding one word, and a second learner (U2) with a home language."""
import lapp.services  # noqa: F401  (import order: services before schemas)
from lapp.models.components import Word
from lapp.models.containers import Language, Lesson
from lapp.models.features import Vocabulary
from lapp.models.system_data import User, UserPreferences
from lapp.services.auth import AuthService
from lapp.services.system_data import CollaborationService, LessonShareService


def seed(db, natives_u2=("eng",)):
    with db.session_scope() as s:
        for uid in ("user_U1", "user_U2"):
            db.insert(User(id=uid, username=uid, email=f"{uid}@x.com"), session=s, commit=False)
        db.insert(UserPreferences(id="pref_U1", user_id="user_U1", native_language_iso639_2=["eng"]), session=s, commit=False)
        db.insert(UserPreferences(id="pref_U2", user_id="user_U2", native_language_iso639_2=list(natives_u2)), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id="user_U1", name="Japanese", iso1="ja", target_iso639_2t="jpn", source_iso639_2t="eng"), session=s, commit=False)
        db.insert(Language(id="lang_L2", user_id="user_U2", name="Japanese", iso1="ja", target_iso639_2t="jpn", source_iso639_2t="eng"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="Lesson one"), session=s, commit=False)
        db.insert(Word(id="word_W1", language_id="lang_L1", word="水", translation="water"), session=s, commit=False)
        db.insert(Vocabulary(id="voc_V1", lesson_id="lesson_L1", word_id="word_W1"), session=s, commit=False)


def share_lesson(lesson_id="lesson_L1", owner="user_U1", other="user_U2"):
    """Invite to the lesson, accept, so `other` holds a lesson share (the real flow)."""
    collab = CollaborationService().invite(owner, other, "lesson", lesson_id)
    CollaborationService().accept(collab.id)
    assert LessonShareService().is_recipient(other, lesson_id)


def client_for(app, uid):
    c = app.test_client()
    c.set_cookie("session_token", AuthService().create_session(uid, remember=False))
    return c
