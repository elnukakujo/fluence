"""Goal flags (spec 3 Task 3): succeeded is permanent, the soft gate never re-closes, rebuild keeps succeeded items, radicals quota is optional."""
import importlib.util
from datetime import datetime, timedelta
from pathlib import Path

from test_study_goal import D0, _goal, _seed
from lapp.services.features import StudyGoalService
from lapp.services.features.lesson_gate import GateService
from lapp.models.components import Character
from lapp.models.system_data import LessonGate, StudyGoalItem
from lapp.services.system_data import ScoreService

U, L = "user_U1", "lang_L1"


def open_ids(svc, day=D0):
    return {i.element_id for i in svc.ensure_cycle(U, L, today=day)}


def test_succeeded_never_clears_after_decay_and_is_not_repicked(db):
    _seed(db)
    svc = StudyGoalService()
    _goal(svc, n_vocabulary=1, n_grammar=0, n_calligraphy=0)
    assert open_ids(svc) == {"voc_V0"}
    ScoreService().set(U, "voc_V0", score=80.0, difficulty=0.5)
    assert svc.mark_succeeded(U, "voc_V0", datetime.now()) is True
    ScoreService().set(U, "voc_V0", score=30.0, difficulty=0.5)                       # decayed far below known
    assert svc.progress(U, L, today=D0)["types"]["vocabulary"]["mastered"] == 1
    assert "voc_V0" not in open_ids(svc, D0 + timedelta(days=7))                      # not carried as unfinished ...
    ids = {i.element_id for i in db.get_session().query(StudyGoalItem).all()}
    assert ids == {"voc_V0", "voc_V1"}                                                 # ... and never picked again as new


def test_reaching_known_outside_record_is_caught_up_on_the_next_read(db):
    _seed(db)
    svc = StudyGoalService()
    _goal(svc, n_vocabulary=1, n_grammar=0, n_calligraphy=0)
    open_ids(svc)
    ScoreService().set(U, "voc_V0", score=70.0, difficulty=0.5)
    assert svc.progress(U, L, today=D0)["types"]["vocabulary"]["mastered"] == 1
    ScoreService().set(U, "voc_V0", score=5.0, difficulty=0.5)
    assert svc.progress(U, L, today=D0)["types"]["vocabulary"]["mastered"] == 1


def test_a_recorded_answer_stamps_the_item(db):
    _seed(db)
    svc = StudyGoalService()
    _goal(svc, n_vocabulary=1, n_grammar=0, n_calligraphy=0)
    open_ids(svc)
    ScoreService().record(U, "voc_V0#front", "recognition", 1.0, "typed")             # far below known: nothing stamped
    assert db.get_session().query(StudyGoalItem).filter_by(element_id="voc_V0").one().succeeded_at is None


def test_soft_gate_offers_only_the_first_lesson_until_it_is_known(db):
    _seed(db, gate_open=False)
    svc = StudyGoalService()
    _goal(svc, n_vocabulary=3, n_grammar=0, n_calligraphy=0)
    assert open_ids(svc) == {"voc_V0", "voc_V1"}                                       # voc_V2 lives in lesson_B: not offered yet
    assert GateService().is_unlocked(U, L, "lesson_A") and not GateService().is_unlocked(U, L, "lesson_B")


def test_gate_opens_when_the_first_lesson_is_known_and_never_closes(db):
    _seed(db, gate_open=False)
    svc = StudyGoalService()
    _goal(svc, n_vocabulary=3, n_grammar=0, n_calligraphy=0)
    open_ids(svc)
    ScoreService().set(U, "lesson_A", score=65.0, difficulty=0.5)
    assert open_ids(svc, D0 + timedelta(days=7)) >= {"voc_V2"}                         # lesson_B now feeds the menu
    assert db.get_session().query(LessonGate).filter_by(user_id=U, language_id=L).count() == 1
    ScoreService().set(U, "lesson_A", score=5.0, difficulty=0.5)                       # decay
    assert GateService().is_unlocked(U, L, "lesson_B")
    GateService().unlock(U, L, "lesson_A")                                             # idempotent
    assert db.get_session().query(LessonGate).count() == 1


def test_rebuild_keep_mastered_keeps_succeeded_and_refills_to_the_new_quantity(db):
    _seed(db, n=5)
    svc = StudyGoalService()
    _goal(svc, n_vocabulary=2, n_grammar=0, n_calligraphy=0)
    open_ids(svc)
    ScoreService().set(U, "voc_V0", score=80.0, difficulty=0.5)
    svc.mark_succeeded(U, "voc_V0", datetime.now())
    ScoreService().set(U, "voc_V0", score=20.0, difficulty=0.5)                        # decayed
    _goal(svc, n_vocabulary=4, n_grammar=0, n_calligraphy=0)                           # a bigger goal for the next period
    svc.reset(U, L, today=D0, keep_mastered=True)
    items = {i.element_id for i in db.get_session().query(StudyGoalItem).all()}
    assert "voc_V0" in items
    assert len(open_ids(svc) | {"voc_V0"}) == 4 and svc.progress(U, L, today=D0)["types"]["vocabulary"]["mastered"] == 1


def test_radicals_quota_is_optional_and_never_blocks(db):
    _seed(db)
    with db.session_scope() as s:
        s.get(Character, "char_C1").key_radical_id = "char_C0"                          # C0 is a radical
    svc = StudyGoalService()
    _goal(svc, n_vocabulary=0, n_grammar=0, n_calligraphy=1)
    assert open_ids(svc) == {"call_C0"} and svc.get(U, L)["n_radicals"] == 0           # default: nothing extra
    svc.reset(U, L, today=D0, keep_mastered=False)
    _goal(svc, n_vocabulary=0, n_grammar=0, n_calligraphy=1, n_radicals=1)
    svc.reset(U, L, today=D0, keep_mastered=False)
    items = {i.element_id: i.radical for i in svc.ensure_cycle(U, L, today=D0)}
    assert items == {"call_C0": True, "call_C1": False}                                # the radical, plus the regular pick
    svc.reset(U, L, today=D0, keep_mastered=False)
    with db.session_scope() as s:
        s.get(Character, "char_C1").key_radical_id = None                               # no radical left: the rest still flows
    assert open_ids(svc) == {"call_C0"}


def test_migration_backfill_stamps_known_items_and_opens_gates(db):
    _seed(db, gate_open=False)
    svc = StudyGoalService()
    _goal(svc, n_vocabulary=0, n_grammar=1, n_calligraphy=0)
    open_ids(svc)
    ScoreService().set(U, "gram_G0", score=75.0, difficulty=0.5)
    ScoreService().set(U, "lesson_A", score=70.0, difficulty=0.5)
    path = next(Path(__file__).parents[1].glob("alembic/versions/*_goal_succeeded_gate.py"))
    spec = importlib.util.spec_from_file_location("goal_gate_migration", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    with db.engine.begin() as conn:
        assert mod.backfill(conn) == {"succeeded": 1, "gates": 1}
        assert mod.backfill(conn) == {"succeeded": 0, "gates": 0}                       # idempotent
