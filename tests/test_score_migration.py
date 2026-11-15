"""Migration d9a3f6b2c8e1: per-skill score rows + stability, additive and idempotent."""
import importlib.util
from datetime import datetime
from pathlib import Path

from lapp.models.data_collection import ProgressTracking
from lapp.models.containers import Language
from lapp.models.system_data import User, Score
from lapp.utils.element_kinds import kind_of
from lapp.utils.scoring import level_for

_spec = importlib.util.spec_from_file_location(
    "mig", Path(__file__).parent.parent / "alembic/versions/d9a3f6b2c8e1_score_skills_and_stability.py")
mig = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mig)

C, L = datetime(2026, 1, 1), datetime(2026, 2, 1)


def _seed(db, elements, answers=()):
    """Old-style data: one Score row per element (skill left at its default), plus answers (element_id, correct)."""
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        for i, (eid, score) in enumerate(elements):
            db.insert(Score(id=f"sc_S{i + 1}", user_id="user_U1", element_id=eid, score=score, difficulty=0.7,
                            created_at=C, last_seen_at=L), session=s, commit=False)
        db.insert(Language(id="lang_X1", user_id="user_U1", name="X", target_iso639_2t="jpn"), session=s, commit=False)
        for i, (eid, ok) in enumerate(answers):
            db.insert(ProgressTracking(id=f"pt_P{i + 1}", user_id="user_U1", language_id="lang_X1", element_id=eid, element_type="x",
                                       element_status="x", score_before=0, score_after=0, result=ok, duration_ms=1),
                      session=s, commit=False)


def _migrate(db):
    with db.engine.begin() as conn:
        mig.backfill_skills(conn)


def _rows(db):
    with db.session_scope() as s:
        return {(r.element_id, r.skill): r for r in s.query(Score)}


def test_matrix_matches_the_element_registry():
    for prefix, skills in mig.MATRIX.items():
        assert kind_of(prefix + "X").skills == skills


def test_each_kind_gets_its_skills_with_score_and_dates_kept(db):
    _seed(db, [("voc_V1", 40.0), ("voc_V1#front", 40.0), ("voc_V1#back", 30.0), ("gram_G1", 55.0),
               ("call_C1", 70.0), ("char_H1", 20.0), ("lesson_L1", 50.0), ("lang_A1", 45.0),
               ("word_W1", 10.0), ("pass_P1", 12.0), ("ex_E1", 5.0)])
    _migrate(db)
    rows = _rows(db)
    assert set(rows) == {
        ("voc_V1", "recognition"), ("voc_V1", "recall"), ("voc_V1#front", "recognition"), ("voc_V1#front", "recall"),
        ("voc_V1#back", "recognition"), ("voc_V1#back", "recall"),
        ("gram_G1", "recognition"), ("call_C1", "recall"), ("char_H1", "recall"),
        ("lesson_L1", "recall"), ("lang_A1", "recall"), ("word_W1", "recall"), ("pass_P1", "recall"), ("ex_E1", "recall"),
    }
    for skill in ("recognition", "recall"):
        r = rows[("voc_V1#back", skill)]
        assert (r.score, r.difficulty, r.created_at, r.last_seen_at) == (30.0, 0.7, C, L)
    assert len({r.id for r in rows.values()}) == len(rows)


def test_only_front_scored_invents_no_back_row(db):
    _seed(db, [("voc_V1#front", 40.0)])
    _migrate(db)
    assert {e for e, _ in _rows(db)} == {"voc_V1#front"}


def test_stability_from_past_correct_answers(db):
    answers = [("voc_V1", True)] * 3 + [("voc_V1", False)] * 2 + [("voc_V2", True)] * 20
    _seed(db, [("voc_V1", 40.0), ("voc_V2", 40.0), ("voc_V3", 40.0), ("voc_V1#front", 40.0)], answers)
    _migrate(db)
    rows = _rows(db)
    assert rows[("voc_V1", "recall")].stability == 16          # 2 * 2**3
    assert rows[("voc_V1#front", "recall")].stability == 16    # a side uses its parent's answers
    assert rows[("voc_V2", "recall")].stability == 180         # capped
    assert rows[("voc_V3", "recall")].stability == 2           # no answers: floor


def test_idempotent_and_never_raises_a_level(db):
    old = [("voc_V1", 59.0), ("voc_V1#front", 62.0), ("gram_G1", 90.0), ("call_C1", 10.0)]
    _seed(db, old)
    _migrate(db)
    once = {k: (r.id, r.score, r.stability) for k, r in _rows(db).items()}
    _migrate(db)
    assert {k: (r.id, r.score, r.stability) for k, r in _rows(db).items()} == once
    for eid, score in old:
        assert {level_for(r.score) for (e, _), r in _rows(db).items() if e == eid} == {level_for(score)}


def test_unique_per_user_element_skill(db):
    _seed(db, [("voc_V1", 40.0)])
    _migrate(db)
    with db.session_scope() as s:   # db_manager.insert logs the integrity error and returns None
        assert db.insert(Score(id="sc_S99", user_id="user_U1", element_id="voc_V1", skill="recall"), session=s, commit=False) is None
    with db.session_scope() as s:
        assert db.insert(Score(id="sc_S98", user_id="user_U1", element_id="voc_V1", skill="listening"), session=s, commit=False)


def test_downgrade_collapses_back_to_one_row_keeping_recall(db):
    _seed(db, [("voc_V1", 40.0), ("gram_G1", 55.0)])
    _migrate(db)
    with db.engine.begin() as conn:
        mig.collapse_skills(conn)
    assert set(_rows(db)) == {("voc_V1", "recall"), ("gram_G1", "recognition")}
