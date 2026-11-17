"""The streak is per learner: 20 answers (or a finished queue) validate the learner's day, whatever the language."""
from datetime import date
from unittest.mock import patch

from lapp.services.data_collection import StudyActivity     # services before schemas: import-order quirk
from lapp.core.database import db_manager
from lapp.models.containers import Language
from lapp.models.data_collection import LearnerDay
from lapp.models.system_data import User
from lapp.schemas.data_collection.progress_tracking import ProgressTrackingDict

U = "user_S1"
CLOCK = "lapp.services.data_collection.study_activity.learner_today"


def _seed(db, languages=("lang_S1",)):
    with db.session_scope() as s:
        db.insert(User(id=U, username="s", email="s@x.com"), session=s, commit=False)
        s.flush()
        for lang in languages:
            db.insert(Language(id=lang, user_id=U, name=lang, target_iso639_2t="jpn"), session=s, commit=False)


def _answer(lang, day, n=1):
    with patch(CLOCK, return_value=day):
        for _ in range(n):
            status = StudyActivity().record(U, lang, ProgressTrackingDict(
                element_id="voc_1", element_type="vocabulary", element_status="learning",
                score_before=0.0, score_after=10.0, result=True, duration_ms=1000.0), tz="UTC")
    return status


def test_validates_at_20_not_19(db):
    _seed(db)
    assert not _answer("lang_S1", date(2026, 11, 2), 19).validated
    last = _answer("lang_S1", date(2026, 11, 2))
    assert last.validated and last.just_validated and last.streak == 1


def test_queue_completion_validates_with_fewer(db):
    _seed(db)
    _answer("lang_S1", date(2026, 11, 2), 3)
    with patch(CLOCK, return_value=date(2026, 11, 2)):
        status = StudyActivity().complete_queue(U, "lang_S1", tz="UTC")
        again = StudyActivity().complete_queue(U, "lang_S1", tz="UTC")
    assert status.validated and status.streak == 1
    assert not again.just_validated and again.streak == 1          # idempotent


def test_two_languages_one_validation_streak_continues(db):
    _seed(db, ("lang_S1", "lang_S2"))
    _answer("lang_S1", date(2026, 11, 2), 20)
    _answer("lang_S1", date(2026, 11, 3), 10)
    status = _answer("lang_S2", date(2026, 11, 3), 10)               # 20 together, across languages
    assert status.validated and status.streak == 2
    with db.session_scope() as s:
        assert s.query(LearnerDay).filter_by(user_id=U, validated=True).count() == 2


def test_gap_resets_streak(db):
    _seed(db)
    _answer("lang_S1", date(2026, 11, 2), 20)
    assert _answer("lang_S1", date(2026, 11, 4), 20).streak == 1


def test_deleting_a_language_keeps_the_streak(db):
    _seed(db, ("lang_S1", "lang_S2"))
    _answer("lang_S2", date(2026, 11, 2), 20)
    from lapp.services import LanguageService
    assert LanguageService().delete("lang_S2")
    with db.session_scope() as s:
        row = s.query(LearnerDay).filter_by(user_id=U, day=date(2026, 11, 2)).one()
        assert row.validated and row.streak_length == 1
