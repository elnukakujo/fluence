from datetime import date, timedelta

import pytest

from lapp.models.system_data import User
from lapp.models.containers import Language, Lesson
from lapp.models.components import Word, Character
from lapp.models.features import Vocabulary, Grammar, Calligraphy
from lapp.services.auth import AuthService
from lapp.services.features import StudyGoalService
from lapp.services.features.lesson_gate import GateService
from lapp.schemas.system_data.user_preferences import UserPreferencesDict
from lapp.services.features.study_constants import default_goal_quantities
from lapp.services.system_data import ScoreService, UserPreferencesService

D0 = date(2026, 1, 1)


def _seed(db, n=3, gate_open=True):
    with db.session_scope() as s:
        for u in ("user_U1", "user_U2"):
            db.insert(User(id=u, username=u, email=f"{u}@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id="user_U1", name="J", target_iso639_2t="jpn"), session=s, commit=False)
        for lid, pos in (("lesson_A", 0), ("lesson_B", 1)):
            db.insert(Lesson(id=lid, user_id="user_U1", language_id="lang_L1", title=lid, position=pos), session=s, commit=False)
        for i in range(n):
            lesson = "lesson_A" if i < 2 else "lesson_B"
            db.insert(Word(id=f"word_W{i}", language_id="lang_L1", word=f"w{i}"), session=s, commit=False)
            db.insert(Vocabulary(id=f"voc_V{i}", lesson_id=lesson, word_id=f"word_W{i}"), session=s, commit=False)
            db.insert(Grammar(id=f"gram_G{i}", lesson_id=lesson, title=f"g{i}", explanation="e"), session=s, commit=False)
            db.insert(Character(id=f"char_C{i}", language_id="lang_L1", character=f"c{i}"), session=s, commit=False)
            db.insert(Calligraphy(id=f"call_C{i}", lesson_id=lesson, character_id=f"char_C{i}"), session=s, commit=False)
    if gate_open:                    # the soft gate (first lesson known) is exercised in test_goal_flags.py
        GateService().unlock("user_U1", "lang_L1", "lesson_A")


def _goal(svc, **kw):
    args = dict(period="week", n_vocabulary=2, n_grammar=1, n_calligraphy=3, today=D0)
    args.update(kw)
    return svc.upsert("user_U1", "lang_L1", **args)


def test_first_cycle_picks_per_type_in_lesson_order(db):
    _seed(db)
    svc = StudyGoalService()
    _goal(svc)
    ids = sorted(i.element_id for i in svc.ensure_cycle("user_U1", "lang_L1", today=D0))
    assert ids == ["call_C0", "call_C1", "call_C2", "gram_G0", "voc_V0", "voc_V1"]
    assert len(svc.ensure_cycle("user_U1", "lang_L1", today=D0)) == 6      # same day adds nothing


def test_next_cycle_adds_new_and_carries_unmastered(db):
    _seed(db)
    svc = StudyGoalService()
    _goal(svc, n_calligraphy=0, n_grammar=0)
    svc.ensure_cycle("user_U1", "lang_L1", today=D0)
    ScoreService().set("user_U1", "voc_V0", score=80.0, difficulty=0.5)   # mastered
    open_ids = {i.element_id for i in svc.ensure_cycle("user_U1", "lang_L1", today=D0 + timedelta(days=7))}
    assert open_ids == {"voc_V1", "voc_V2"}                                # V1 carried, V2 new, V0 left
    t = svc.progress("user_U1", "lang_L1", today=D0 + timedelta(days=7))["types"]["vocabulary"]
    assert (t["n"], t["picked"], t["mastered"], t["carried"]) == (2, 1, 0, 1)


def test_fewer_unstarted_than_n(db):
    _seed(db, n=1)
    svc = StudyGoalService()
    _goal(svc, n_vocabulary=5)
    assert len(_voc(svc)) == 1
    assert svc.progress("user_U1", "lang_L1", today=D0)["types"]["vocabulary"]["picked"] == 1


def _voc(svc, today=D0):
    return sorted(i.element_id for i in svc.ensure_cycle("user_U1", "lang_L1", today=today) if i.element_id.startswith("voc_"))


def test_menu_is_locked_for_the_period_and_changes_apply_next_period(db):
    _seed(db)
    svc = StudyGoalService()
    _goal(svc, n_vocabulary=3, n_grammar=0, n_calligraphy=0)
    assert _voc(svc) == ["voc_V0", "voc_V1", "voc_V2"]
    _goal(svc, n_vocabulary=1, n_grammar=0, n_calligraphy=0)                  # lowered mid-period
    assert _voc(svc, D0 + timedelta(days=3)) == ["voc_V0", "voc_V1", "voc_V2"]
    nxt = svc.progress("user_U1", "lang_L1", today=D0 + timedelta(days=3))["next"]
    assert nxt["pending"] and nxt["n"]["vocabulary"] == 1 and nxt["start"] == (D0 + timedelta(days=7)).isoformat()
    ScoreService().set("user_U1", "voc_V0", score=80.0, difficulty=0.5)
    assert _voc(svc, D0 + timedelta(days=7)) == ["voc_V1", "voc_V2"]          # next period: 1 new (V3 is absent), V1/V2 carried


def test_raising_n_mid_period_does_not_grow_the_menu(db):
    _seed(db)
    svc = StudyGoalService()
    _goal(svc, n_vocabulary=1, n_grammar=0, n_calligraphy=0)
    assert _voc(svc) == ["voc_V0"]
    _goal(svc, n_vocabulary=3, n_grammar=0, n_calligraphy=0)
    assert _voc(svc, D0 + timedelta(days=2)) == ["voc_V0"]
    assert len(_voc(svc, D0 + timedelta(days=7))) == 3                        # applied once the period rolls over


def test_empty_slots_fill_when_elements_appear_but_never_beyond_the_locked_quantity(db):
    _seed(db, n=1)
    svc = StudyGoalService()
    _goal(svc, n_vocabulary=2, n_grammar=0, n_calligraphy=0)
    assert _voc(svc) == ["voc_V0"]                                            # only one exists
    with db.session_scope() as s:
        for k in ("X", "Y"):
            db.insert(Word(id=f"word_W{k}", language_id="lang_L1", word=k), session=s, commit=False)
            db.insert(Vocabulary(id=f"voc_V{k}", lesson_id="lesson_A", word_id=f"word_W{k}"), session=s, commit=False)
    assert _voc(svc) == ["voc_V0", "voc_VX"]                                  # one slot was free, not two


def test_review_slots_take_seen_elements_and_are_done_once_reviewed_in_the_period(db):
    _seed(db, n=4)
    svc = StudyGoalService()
    ScoreService().set("user_U1", "voc_V3", score=40.0, difficulty=0.5, touch=False)   # seen before, not in the period
    _goal(svc, n_vocabulary=1, n_grammar=0, n_calligraphy=0, r_vocabulary=1)
    items = {i.element_id: i.kind for i in svc.ensure_cycle("user_U1", "lang_L1", today=D0)}
    assert items == {"voc_V0": "new", "voc_V3": "review"}
    ScoreService().record_side("user_U1", "voc_V3", "front", "recognition", 1.0, "typed")
    assert "voc_V3" in {i.element_id for i in svc.ensure_cycle("user_U1", "lang_L1", today=D0)}   # one side is not enough
    ScoreService().record_side("user_U1", "voc_V3", "back", "recall", 1.0, "typed")
    assert "voc_V3" not in {i.element_id for i in svc.ensure_cycle("user_U1", "lang_L1", today=D0)}
    t = svc.progress("user_U1", "lang_L1", today=D0)["types"]["vocabulary"]
    assert (t["r"], t["review_picked"], t["review_done"]) == (1, 1, 1)


def test_progress_lists_the_elements_with_labels_and_roles(db):
    _seed(db)
    svc = StudyGoalService()
    _goal(svc, n_vocabulary=1, n_grammar=1, n_calligraphy=1)
    items = svc.progress("user_U1", "lang_L1", today=D0)["items"]
    assert {i["lesson_id"] for i in items} == {"lesson_A"}                       # for linking to the element's page
    assert {(i["kind"], i["role"], i["label"], i["done"], i["carried"]) for i in items} == {
        ("vocabulary", "new", "w0", False, False), ("grammar", "new", "g0", False, False), ("calligraphy", "new", "c0", False, False)}


def test_inactive_picks_nothing(db):
    _seed(db)
    svc = StudyGoalService()
    _goal(svc, active=False)
    assert svc.ensure_cycle("user_U1", "lang_L1", today=D0) == []


def test_deleted_element_is_dropped(db):
    _seed(db)
    svc = StudyGoalService()
    _goal(svc, n_grammar=0, n_calligraphy=0)
    svc.ensure_cycle("user_U1", "lang_L1", today=D0)
    with db.session_scope() as s:
        s.delete(s.get(Vocabulary, "voc_V0"))
    ids = {i.element_id for i in svc.ensure_cycle("user_U1", "lang_L1", today=D0)}
    assert "voc_V0" not in ids


def test_validation(db):
    _seed(db)
    for bad in (dict(period="day"), dict(n_vocabulary=-1), dict(n_grammar="x")):
        with pytest.raises(ValueError):
            _goal(StudyGoalService(), **bad)


def test_routes(app, db):
    _seed(db)
    c = app.test_client()
    c.set_cookie("session_token", AuthService().create_session("user_U1", remember=False))
    first = c.get("/api/study-goal/lang_L1").get_json()      # no preferences row in this test, so no default goal either
    assert first["goal"] is None and first["progress"] is None and first["suggested"]["n"]["vocabulary"] == 9
    assert c.put("/api/study-goal/lang_L1", json={"period": "day"}).status_code == 400
    ok = c.put("/api/study-goal/lang_L1", json={"period": "biweek", "n_vocabulary": 2, "n_grammar": 1, "n_calligraphy": 0})
    assert ok.status_code == 200 and ok.get_json()["progress"]["types"]["vocabulary"]["picked"] == 2
    other = app.test_client()
    other.set_cookie("session_token", AuthService().create_session("user_U2", remember=False))
    assert other.get("/api/study-goal/lang_L1").status_code == 403


def test_default_quantities_follow_new_per_week_and_reviews_per_day():
    assert default_goal_quantities(15, 40) == {"n": {"vocabulary": 9, "grammar": 2, "calligraphy": 4}, "r": {"vocabulary": 23, "grammar": 6, "calligraphy": 11}}
    assert default_goal_quantities(30, 40)["n"] == {"vocabulary": 17, "grammar": 4, "calligraphy": 9}
    assert default_goal_quantities(14, 40, 14)["n"] == {"vocabulary": 16, "grammar": 4, "calligraphy": 8}      # a two-week period doubles it
    tiny = default_goal_quantities(1, 1)
    assert all(v >= 1 for v in tiny["n"].values()) and all(v >= 1 for v in tiny["r"].values())
    assert set(default_goal_quantities(0, 0)["n"].values()) == {0}


def _prefs(new_per_week):
    UserPreferencesService().create(UserPreferencesDict(user_id="user_U1", new_per_week=new_per_week))


def test_ensure_default_gives_a_language_the_suggested_goal(db):
    _seed(db)
    svc = StudyGoalService()
    assert svc.ensure_default("user_U1", "lang_L1") is None            # no preferences yet: nothing to base it on
    _prefs(30)
    goal = svc.ensure_default("user_U1", "lang_L1")
    assert goal["auto"] and goal["period"] == "week" and goal["n_vocabulary"] == 17 and goal["r_calligraphy"] == 11
    assert svc.ensure_default("user_U1", "lang_L1")["id"] == goal["id"]  # not recreated


def test_upsert_auto_uses_the_suggested_numbers_whatever_is_sent(db):
    _seed(db)
    _prefs(15)
    goal = StudyGoalService().upsert("user_U1", "lang_L1", "month", 1, 1, 1, True, 0, 0, 0, True)
    assert goal["auto"] and goal["period"] == "month" and goal["n_vocabulary"] == 37


def test_reset_unlocks_the_running_menu_and_rebuilds_from_current_quantities(db):
    _seed(db)
    svc = StudyGoalService()
    _goal(svc)
    svc.ensure_cycle("user_U1", "lang_L1", today=D0)
    _goal(svc, n_vocabulary=1)                                    # locked: still 2 until the next period
    assert svc.progress("user_U1", "lang_L1", today=D0)["types"]["vocabulary"]["n"] == 2
    svc.reset("user_U1", "lang_L1", today=D0)
    p = svc.progress("user_U1", "lang_L1", today=D0)
    assert p["types"]["vocabulary"]["n"] == 1 and p["types"]["vocabulary"]["picked"] == 1


def test_first_own_save_replaces_the_suggested_menu_at_once(db):
    _seed(db)
    svc = StudyGoalService()
    svc.upsert("user_U1", "lang_L1", "week", 0, 0, 0, auto=True, today=D0)
    svc.ensure_cycle("user_U1", "lang_L1", today=D0)             # the suggested menu is now locked
    _goal(svc, n_vocabulary=1, n_grammar=0, n_calligraphy=0)     # the user enters their own numbers
    t = svc.progress("user_U1", "lang_L1", today=D0)["types"]["vocabulary"]
    assert (t["n"], t["picked"]) == (1, 1)


def test_mastery_bar_is_60(db):
    _seed(db)
    svc = StudyGoalService()
    _goal(svc, n_grammar=0, n_calligraphy=0)
    svc.ensure_cycle("user_U1", "lang_L1", today=D0)
    ScoreService().set("user_U1", "voc_V0", score=60.0, difficulty=0.5)
    ScoreService().set("user_U1", "voc_V1", score=59.0, difficulty=0.5)
    t = svc.progress("user_U1", "lang_L1", today=D0)["types"]["vocabulary"]
    assert t["mastered"] == 1


def test_unreviewed_review_item_carries_over_once(db):
    _seed(db, n=4)
    svc = StudyGoalService()
    ScoreService().set("user_U1", "voc_V3", score=40.0, difficulty=0.5, touch=False)
    _goal(svc, n_vocabulary=0, n_grammar=0, n_calligraphy=0, r_vocabulary=1)
    svc.ensure_cycle("user_U1", "lang_L1", today=D0)
    week2 = D0 + timedelta(days=7)
    p = svc.progress("user_U1", "lang_L1", today=week2)
    carried = [i for i in p["items"] if i["id"] == "voc_V3"]
    assert len(carried) == 1 and carried[0]["carried"] is True and carried[0]["role"] == "review"
    assert p["types"]["vocabulary"]["carried"] == 1


def test_reviewed_review_item_does_not_carry(db):
    _seed(db, n=4)
    svc = StudyGoalService()
    ScoreService().set("user_U1", "voc_V3", score=40.0, difficulty=0.5, touch=False)
    _goal(svc, n_vocabulary=0, n_grammar=0, n_calligraphy=0, r_vocabulary=1)
    svc.ensure_cycle("user_U1", "lang_L1", today=date.today())      # reviews below are stamped "now"
    ScoreService().record_side("user_U1", "voc_V3", "front", "recognition", 1.0, "typed")
    ScoreService().record_side("user_U1", "voc_V3", "back", "recall", 1.0, "typed")
    p = svc.progress("user_U1", "lang_L1", today=date.today() + timedelta(days=7))
    assert all(not i["carried"] for i in p["items"])


def test_rebuild_keeps_mastered_and_redraws_the_rest(db):
    _seed(db)
    svc = StudyGoalService()
    _goal(svc, n_grammar=0, n_calligraphy=0)
    svc.ensure_cycle("user_U1", "lang_L1", today=D0)                # V0, V1 picked
    ScoreService().set("user_U1", "voc_V0", score=80.0, difficulty=0.5)
    assert svc.progress("user_U1", "lang_L1", today=D0)["rebuild"] == {"mastered": 1, "redraw": 1}
    svc.reset("user_U1", "lang_L1", today=D0)
    p = svc.progress("user_U1", "lang_L1", today=D0)
    ids = [i["id"] for i in p["items"] if i["role"] == "new"]
    assert "voc_V0" in ids and len(ids) == len(set(ids)) == 2
    assert p["types"]["vocabulary"]["mastered"] == 1


def test_rebuild_with_keep_false_drops_everything(db):
    _seed(db)
    svc = StudyGoalService()
    _goal(svc, n_grammar=0, n_calligraphy=0)
    svc.ensure_cycle("user_U1", "lang_L1", today=D0)
    ScoreService().set("user_U1", "voc_V0", score=80.0, difficulty=0.5)
    svc.reset("user_U1", "lang_L1", today=D0, keep_mastered=False)
    ids = {i["id"] for i in svc.progress("user_U1", "lang_L1", today=D0)["items"]}
    assert "voc_V0" not in ids         # mastered now, so it is not redrawn as "new"


def test_a_type_the_course_does_not_study_has_no_slots_picks_or_suggestion(db):
    from lapp.models.system_data import CourseSetting
    _seed(db)
    UserPreferencesService().create(UserPreferencesDict(user_id="user_U1"))
    svc = StudyGoalService()
    _goal(svc)
    assert any(i["kind"] == "calligraphy" for i in svc.progress("user_U1", "lang_L1", today=D0)["items"])
    with db.session_scope() as s:
        db.insert(CourseSetting(id="cs_x", user_id="user_U1", language_id="lang_L1", key="element_types", value=["vocabulary", "grammar", "exercises"]), session=s, commit=False)
    p = svc.progress("user_U1", "lang_L1", today=D0)
    assert not any(i["kind"] == "calligraphy" for i in p["items"]) and p["types"]["calligraphy"]["n"] + p["types"]["calligraphy"]["r"] == 0
    assert svc.get("user_U1", "lang_L1")["n_calligraphy"] == 0 and svc.kinds("user_U1", "lang_L1") == ["vocabulary", "grammar"]
    sug = svc.suggested("user_U1", "week", "lang_L1")
    assert sug["n"]["calligraphy"] == 0 and sum(sug["n"].values()) == 15 and sum(sug["r"].values()) == 40


def test_new_is_only_unseen_and_review_only_seen_even_outside_a_goal(db):
    """SG-12: a card answered outside any goal (even wrongly, score 0) is Review material, never New; unseen is never Review."""
    _seed(db, n=4)
    svc = StudyGoalService()
    ScoreService().record_side("user_U1", "voc_V0", "front", "recognition", 0.0, "typed")   # wrong first answer: score stays 0
    ScoreService().set("user_U1", "voc_V3", score=40.0, difficulty=0.5, touch=False)
    _goal(svc, n_vocabulary=2, n_grammar=0, n_calligraphy=0, r_vocabulary=2)
    kinds = {i.element_id: i.kind for i in svc.ensure_cycle("user_U1", "lang_L1", today=D0)}
    assert kinds["voc_V0"] == "review" and kinds["voc_V3"] == "review"
    assert {e for e, k in kinds.items() if k == "new"} == {"voc_V1", "voc_V2"}


def test_partial_progress_counts_unmet_items_as_fractions_of_the_known_bar(db):
    """SG-13: a new element at 30 is half of one; a done one counts nothing extra; a vocabulary review with one side seen is half."""
    _seed(db, n=4)
    svc = StudyGoalService()
    ScoreService().set("user_U1", "voc_V3", score=40.0, difficulty=0.5, touch=False)
    _goal(svc, n_vocabulary=2, n_grammar=0, n_calligraphy=0, r_vocabulary=1)
    svc.ensure_cycle("user_U1", "lang_L1", today=D0)
    ScoreService().set("user_U1", "voc_V0", score=30.0, difficulty=0.5)
    ScoreService().set("user_U1", "voc_V1", score=70.0, difficulty=0.5)                       # done: not partial
    ScoreService().record_side("user_U1", "voc_V3", "front", "recognition", 1.0, "typed")
    t = svc.progress("user_U1", "lang_L1", today=D0)["types"]["vocabulary"]
    assert t["mastered"] == 1 and t["partial"] == pytest.approx(0.5)
    assert t["review_done"] == 0 and t["review_partial"] == pytest.approx(0.5)


def test_each_unmet_item_says_how_far_it_is_and_carried_ones_count(db):
    """SG-13: the menu shows every element's distance: points left to Known (new) or sides left (review), carried items included."""
    _seed(db, n=4)
    svc = StudyGoalService()
    _goal(svc, n_vocabulary=2, n_grammar=0, n_calligraphy=0)
    svc.ensure_cycle("user_U1", "lang_L1", today=D0)
    ScoreService().set("user_U1", "voc_V0", score=30.0, difficulty=0.5)
    ScoreService().set("user_U1", "voc_V1", score=70.0, difficulty=0.5)
    items = {i["id"]: i for i in svc.progress("user_U1", "lang_L1", today=D0)["items"]}
    assert (items["voc_V0"]["progress"], items["voc_V0"]["to_go"]) == (0.5, 30)
    assert items["voc_V1"]["progress"] is None and items["voc_V1"]["to_go"] is None          # done
    later = svc.progress("user_U1", "lang_L1", today=D0 + timedelta(days=7))
    carried = [i for i in later["items"] if i["carried"]]
    assert [i["id"] for i in carried] == ["voc_V0"] and carried[0]["to_go"] == 30
    assert later["types"]["vocabulary"]["carried_partial"] == pytest.approx(0.5)


def test_items_carry_their_score_and_level_for_the_hover_card(db):
    _seed(db, n=3)
    svc = StudyGoalService()
    _goal(svc, n_vocabulary=2, n_grammar=0, n_calligraphy=0)
    svc.ensure_cycle("user_U1", "lang_L1", today=D0)
    ScoreService().set("user_U1", "voc_V0", score=30.0, difficulty=0.5)
    ScoreService().set("user_U1", "voc_V1", score=70.0, difficulty=0.5)
    items = {i["id"]: i for i in svc.progress("user_U1", "lang_L1", today=D0)["items"]}
    assert (items["voc_V0"]["score"], items["voc_V0"]["level"]) == (30.0, "learning")
    assert (items["voc_V1"]["score"], items["voc_V1"]["level"]) == (70.0, "known")
