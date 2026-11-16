"""days_active must increment at most once per calendar day.

Run: `uv run pytest tests/test_commitment_log.py`
"""
from datetime import date

from lapp.core.database import db_manager
from lapp.models.system_data import User
from lapp.models.containers.language import Language
from lapp.models.data_collection.progress_tracking import ProgressTracking
from lapp.services.data_collection.commitment_log import CommitmentLogService

commitment_log_service = CommitmentLogService()


def _make_progress_tracking(session, user_id, language_id, suffix):
    pt = ProgressTracking(
        id=f"pt_{suffix}",
        user_id=user_id,
        language_id=language_id,
        element_type="vocabulary",
        element_status="learning",
        score_before=0.0,
        score_after=10.0,
        result=True,
        duration_ms=1000.0,
        element_id="voc_1",
    )
    db_manager.insert(pt, session=session, commit=False)
    return pt


def test_days_active_counts_once_per_day(db):
    with db.session_scope() as session:
        db_manager.insert(User(id="user_C1", username="erin"), session=session, commit=False)
        db_manager.insert(Language(id="lang_C1", user_id="user_C1", name="Test"), session=session, commit=False)

    with db.session_scope() as session:
        pt1 = _make_progress_tracking(session, "user_C1", "lang_C1", "1")
        commitment_log_service.apply_progress_tracking(pt1.id, session=session, day=date(2026, 7, 15))

        pt2 = _make_progress_tracking(session, "user_C1", "lang_C1", "2")
        commitment_log_service.apply_progress_tracking(pt2.id, session=session, day=date(2026, 7, 15))

    entry = commitment_log_service.get_for_user("user_C1", "lang_C1", as_dict=True)
    assert entry["days_active"] == 1
    assert entry["total_items_reviewed"] == 2

    with db.session_scope() as session:
        pt3 = _make_progress_tracking(session, "user_C1", "lang_C1", "3")
        commitment_log_service.apply_progress_tracking(pt3.id, session=session, day=date(2026, 7, 16))

    entry = commitment_log_service.get_for_user("user_C1", "lang_C1", as_dict=True)
    assert entry["days_active"] == 2
