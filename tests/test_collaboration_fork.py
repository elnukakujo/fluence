"""Collaboration fork: dedupe-by-ISO + per-user Score carry."""
from lapp.models.system_data import User, Collaboration, Score
from lapp.models.containers import Language, Lesson
from lapp.models.features import Vocabulary
from lapp.models.components import Word
from lapp.services.system_data import CollaborationService, ScoreService


def _seed(db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(User(id="user_U2", username="b", email="b@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id="user_U1", name="Japanese", alias="JP",
                           target_iso639_2t="jpn", source_iso639_2t="eng", description="master desc"),
                  session=s, commit=False)
        db.insert(Language(id="lang_U2", user_id="user_U2", name="日本語", alias="日",
                           target_iso639_2t="jpn", source_iso639_2t="eng", description="invitee desc"),
                  session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="L1"),
                  session=s, commit=False)
        db.insert(Word(id="word_W1", language_id="lang_L1", word="水"), session=s, commit=False)
        db.insert(Vocabulary(id="voc_V1", lesson_id="lesson_L1", word_id="word_W1"), session=s, commit=False)


def _invite():
    return CollaborationService().invite("user_U1", "user_U2", "language", "lang_L1")


def test_fork_dedupes_by_iso(db):
    _seed(db)
    CollaborationService().remove(_invite().id)
    with db.session_scope() as s:
        langs = s.query(Language).filter(Language.user_id == "user_U2").all()
        assert len(langs) == 1                       # merged into the existing "jpn" language
        assert langs[0].name == "日本語"              # invitee's language kept
        assert langs[0].description == "invitee desc"  # description unchanged
        lessons = s.query(Lesson).filter(Lesson.language_id == langs[0].id).all()
        assert any(l.title == "L1" for l in lessons)  # master's lesson added


def test_fork_carries_score(db):
    _seed(db)
    c = _invite()
    # collaborator scores the shared vocab while collaborating
    ScoreService().record("user_U2", "voc_V1", 0.9)
    before = ScoreService().get("user_U2", "voc_V1").score
    assert before > 0.0
    CollaborationService().remove(c.id)
    with db.session_scope() as s:
        # Score remapped away from the shared id
        assert s.query(Score).filter(Score.user_id == "user_U2", Score.element_id == "voc_V1").first() is None
        # carried onto the forked vocab
        lang = s.query(Language).filter(Language.user_id == "user_U2").one()
        lesson = s.query(Lesson).filter(Lesson.language_id == lang.id, Lesson.title == "L1").one()
        voc = s.query(Vocabulary).filter(Vocabulary.lesson_id == lesson.id).one()
        carried = s.query(Score).filter(Score.user_id == "user_U2", Score.element_id == voc.id).first()
        assert carried is not None and carried.score == before
