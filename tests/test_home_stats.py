"""Home headline numbers (spec 3 Task 6): coverage and mean-of-seen apart, fading = succeeded now below known, relative heatmap bands, no NaN when empty."""
import math
from datetime import datetime

from sqlalchemy import event

from test_study_goal import D0, _goal, _seed
from lapp.services.features import StudyGoalService
from lapp.services.data_collection import home_stats
from lapp.models.system_data import User
from lapp.models.containers import Language
from lapp.services.system_data import ScoreService
from lapp.services import ReviewService
from lapp.utils.learner_clock import learner_today

U = "user_U1"


def test_empty_learner_has_no_nan(db):
    with db.session_scope() as s:
        db.insert(User(id=U, username="a", email="a@x.com"), session=s, commit=False)
    out = home_stats.home(U, "UTC")
    assert out["streak"] == 0 and out["languages"] == [] and len(out["weeks"]) == home_stats.HEATMAP_WEEKS
    assert all(w["answers"] == 0 for w in out["weeks"]) and out["week_delta"] == 0
    assert all(isinstance(b, int) and b >= 1 for b in out["heatmap_bands"])


def test_language_without_scores_renders_zeros(db):
    _seed(db)
    lang = home_stats.home(U, "UTC")["languages"][0]
    assert lang["levels"] == {"learning": 0, "known": 0, "mastered": 0} and lang["coverage"] == 0.0 and lang["mean_seen"] is None
    assert not any(isinstance(v, float) and math.isnan(v) for v in lang.values() if not isinstance(v, dict))


def test_coverage_and_mean_of_seen_are_separate_fields(db):
    _seed(db)
    ScoreService().set(U, "voc_V0", score=50.0, difficulty=0.5)
    ScoreService().set(U, "voc_V1", score=90.0, difficulty=0.5)
    lang = home_stats.home(U, "UTC")["languages"][0]
    assert abs(lang["coverage"] - 2 / 9) < 1e-9                       # 2 of 9 elements ever scored
    assert abs(lang["mean_seen"] - 70.0) < 1.0                         # mean of the seen ones only, unseen excluded
    assert lang["levels"] == {"learning": 1, "known": 0, "mastered": 1}


def test_fading_counts_succeeded_items_now_below_known(db):
    _seed(db)
    svc = StudyGoalService()
    _goal(svc, n_vocabulary=1, n_grammar=0, n_calligraphy=0)
    svc.ensure_cycle(U, "lang_L1", today=D0)
    ScoreService().set(U, "voc_V0", score=80.0, difficulty=0.5)
    svc.mark_succeeded(U, "voc_V0", datetime.now())
    assert home_stats.home(U, "UTC")["languages"][0]["fading"] == 0
    ScoreService().set(U, "voc_V0", score=30.0, difficulty=0.5)
    assert home_stats.home(U, "UTC")["languages"][0]["fading"] == 1


def test_heatmap_bands_scale_with_the_learners_median():
    light = home_stats.heatmap_bands([0, 4, 6, 8, 0])
    heavy = home_stats.heatmap_bands([0, 40, 60, 80, 0])
    assert light == sorted(light) and heavy == sorted(heavy)
    assert all(h > l for h, l in zip(heavy, light))
    assert home_stats.heatmap_bands([]) == [1, 1, 2]                 # nobody active yet: median 1


def _summary(db, user_id, language_id):
    return home_stats.language_summary(user_id, language_id, learner_today("UTC"))


def test_language_summary_equals_home_entry(db):
    _seed(db)
    ScoreService().set(U, "voc_V0", score=50.0, difficulty=0.5)
    assert _summary(db, U, "lang_L1") == home_stats.home(U, "UTC")["languages"][0]


def test_language_summary_none_for_foreign_language(db):
    _seed(db)
    assert _summary(db, "user_U2", "lang_L1") is None
    assert _summary(db, U, "lang_missing") is None


def test_due_matches_served_queue(db):
    _seed(db)
    served = ReviewService().get_review_cards("lang_L1", user_id=U, as_dict=True)
    assert _summary(db, U, "lang_L1")["due"] == len(served) > 0


def test_language_without_lessons_has_nothing_due(db):
    _seed(db)
    with db.session_scope() as s:
        db.insert(Language(id="lang_L2", user_id=U, name="Empty", target_iso639_2t="spa"), session=s, commit=False)
    out = _summary(db, U, "lang_L2")
    assert out["due"] == 0 and out["due_minutes"] == 0 and out["coverage"] == 0.0


def test_no_statement_ships_an_id_per_bind_parameter(db):
    """Score reads send the id list as one array parameter: thousands of bind parameters per statement are what made
    one home() call cost seconds on the 2-core VM (scripts/profile_home_stats.py)."""
    _seed(db, n=40)
    for i in range(0, 40, 2):
        ScoreService().set(U, f"voc_V{i}", score=40.0, difficulty=0.5)
    widest = [0]

    def watch(conn, cursor, statement, parameters, context, executemany):
        widest[0] = max(widest[0], len(parameters))

    event.listen(db.engine, "before_cursor_execute", watch)
    try:
        _summary(db, U, "lang_L1")
    finally:
        event.remove(db.engine, "before_cursor_execute", watch)
    assert widest[0] <= 50, f"a statement carried {widest[0]} bind parameters"
