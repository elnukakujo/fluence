"""RC-27: the Today counter counts cards: the rows an exercise writes for its linked elements are scored, not counted."""
from test_exercise_credit import U, _body, _client, _result
from lapp.models.data_collection.daily_stats import DailyStats
from lapp.models.data_collection.progress_tracking import ProgressTracking
from lapp.services.data_collection.daily_stats import DailyStatsService


def _items(db):
    with db.session_scope() as s:
        return sum(r.items_reviewed for r in s.query(DailyStats).all())


def _row(db, element_id, card_id, n):
    with db.session_scope() as s:
        db.insert(ProgressTracking(id=f"pt_{n}", user_id=U, language_id="lang_L1", element_id=element_id, element_type="vocabulary",
                                   element_status="seen", score_before=0, score_after=1, result=True, duration_ms=5, hint_used=False,
                                   attempt_number=1, card_id=card_id), session=s, commit=False)
        DailyStatsService().update(progress_tracking_id=f"pt_{n}", session=s)


def test_an_exercise_with_two_linked_elements_counts_once(app, db):
    c = _client(app, db)
    c.post("/api/exercise/score", json=_body([_result("voc_V1", 1.0), _result("voc_V2", 0.0)]))
    assert _items(db) == 1


def test_a_card_row_and_a_legacy_row_count_once_each_and_a_linked_row_not_at_all(app, db):
    _client(app, db)
    _row(db, "voc_V1", "voc_V1", 1)        # a vocabulary card
    _row(db, "voc_V2", None, 2)            # legacy row: no card_id
    _row(db, "voc_V1", "ex_E1", 3)         # element credited by an exercise
    assert _items(db) == 2
