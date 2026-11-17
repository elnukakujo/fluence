"""One queue, several entry points (spec 3 Task 2): scopes, exercises everywhere, bonus items, decay priority."""
import random
from datetime import datetime

from review_helpers import link_all_exercises
from lapp.services import ReviewService  # services first: schemas<->services import cycle
from lapp.core.database import db_manager
from lapp.models.base import tag_element_link, source_element_link
from lapp.models.system_data import User, Tag, Source
from lapp.models.containers import Language, Lesson
from lapp.models.components import Word, Character
from lapp.models.features import Vocabulary, Grammar, Calligraphy, Exercise
from lapp.schemas.system_data.user_preferences import UserPreferencesDict
from lapp.services.features import StudyGoalService
from lapp.services.features.review_queue import Scope, order_bucket
from lapp.services.system_data import ScoreService, UserPreferencesService

U, L = "user_U1", "lang_L1"


def seed(db):
    with db.session_scope() as s:
        db.insert(User(id=U, username="a", email="a@x.com"), session=s, commit=False)
        db.insert(Language(id=L, user_id=U, name="J", target_iso639_2t="jpn"), session=s, commit=False)
        for n in (1, 2):
            db.insert(Lesson(id=f"lesson_L{n}", user_id=U, language_id=L, title=f"L{n}", position=n), session=s, commit=False)
        for i in range(4):
            db.insert(Word(id=f"word_W{i}", language_id=L, word=f"w{i}"), session=s, commit=False)
            db.insert(Vocabulary(id=f"voc_V{i}", lesson_id=f"lesson_L{i % 2 + 1}", word_id=f"word_W{i}"), session=s, commit=False)
        for i in range(2):
            db.insert(Grammar(id=f"gram_G{i}", lesson_id=f"lesson_L{i + 1}", title=f"g{i}", explanation="e"), session=s, commit=False)
        for i in range(3):
            db.insert(Character(id=f"char_C{i}", language_id=L, character=f"c{i}", key_radical_id="char_C0" if i == 1 else None), session=s, commit=False)
            db.insert(Calligraphy(id=f"call_C{i}", lesson_id="lesson_L2", character_id=f"char_C{i}"), session=s, commit=False)
        for i in range(4):
            db.insert(Exercise(id=f"ex_E{i}", lesson_id=f"lesson_L{i % 2 + 1}", exercise_type="translate", question="q", answer="a"), session=s, commit=False)
        db.insert(Tag(id="tag_T1", name="t", user_id=U), session=s, commit=False)
        db.insert(Source(id="src_S1", title="s", source_type="textbook", user_id=U), session=s, commit=False)
        s.flush()
        s.execute(tag_element_link.insert().values(tag_id="tag_T1", element_id="voc_V0"))
        s.execute(tag_element_link.insert().values(tag_id="tag_T1", element_id="lesson_L2"))
        s.execute(source_element_link.insert().values(source_id="src_S1", element_id="gram_G0"))
    link_all_exercises(db)


def queue(scope, **prefs):
    if prefs:
        UserPreferencesService().create(UserPreferencesDict(user_id=U, **prefs))
    return ReviewService().get_review_cards(language_id=L, user_id=U, as_dict=True, scope=scope)


def ids(cards, spare=False):
    return {c["id"] for c in cards if c["spare"] == spare}


def test_lesson_scope_is_only_that_lesson_and_has_the_common_item_shape(db):
    seed(db)
    cards = queue(Scope("lesson", lesson_id="lesson_L1"))
    assert {c["lesson_id"] for c in cards} == {"lesson_L1"}
    assert {"voc_V0", "voc_V2", "gram_G0", "ex_E0", "ex_E2"} == ids(cards)
    assert all({"kind", "skill", "bonus", "est_seconds", "lesson_title"} <= set(c) for c in cards)
    assert {c["kind"] for c in cards} == {"vocabulary", "grammar", "exercise"}
    assert {c["side"] for c in cards if c["kind"] == "vocabulary"} == {"front", "back"}


def test_unknown_lesson_gives_an_empty_queue(db):
    seed(db)
    assert queue(Scope("lesson", lesson_id="lesson_NOPE")) == []


def test_tag_scope_brings_the_tagged_element_and_the_cards_of_a_tagged_lesson(db):
    seed(db)
    got = ids(queue(Scope("tag", tag_id="tag_T1")))
    assert {"voc_V0", "voc_V1", "voc_V3", "gram_G1", "call_C0", "call_C1", "call_C2"} <= got     # V0 + everything in lesson_L2
    assert "voc_V2" not in got and "gram_G0" not in got


def test_source_scope(db):
    seed(db)
    assert {"gram_G0"} <= ids(queue(Scope("source", source_id="src_S1")))
    assert "gram_G1" not in ids(queue(Scope("source", source_id="src_S1")))


def test_type_scope_keeps_the_type(db):
    seed(db)
    assert {c["kind"] for c in queue(Scope("type", element_type="grammar"))} <= {"grammar", "exercise"}


def test_free_scope_returns_exactly_the_ids_and_ignores_the_time_budget(db):
    seed(db)
    asked = ["voc_V0", "gram_G1", "call_C2", "ex_E1"]
    cards = queue(Scope("free", ids=asked), reviews_per_day=1)
    assert ids(cards) == set(asked) and {c.get("side") for c in cards if c["id"] == "voc_V0"} == {"front", "back"}


def test_exercises_follow_the_linked_average_gate_in_every_scope(db):
    seed(db)
    ScoreService().set(U, "voc_LINK", 5.0, 0.5)             # linked elements known too little (< 20)
    assert not [c for c in queue(Scope("lesson", lesson_id="lesson_L1")) if c["kind"] == "exercise"]
    ScoreService().set(U, "voc_LINK", 50.0, 0.5)
    assert [c for c in queue(Scope("lesson", lesson_id="lesson_L1")) if c["kind"] == "exercise"]


def test_daily_scope_is_the_default_queue(db):
    seed(db)
    random.seed(1)
    first = queue(Scope())
    random.seed(1)                                          # no goal yet: new elements are drawn at random
    assert first == queue(Scope("daily")) and first


def test_bonus_items_follow_the_menu_and_are_never_unstarted(db):
    seed(db)
    StudyGoalService().upsert(U, L, "week", 1, 0, 0)          # the menu: one new vocabulary
    ScoreService().record_side(U, "voc_V3", "front", "recognition", 1.0, "typed")      # a started word outside the menu
    cards = queue(Scope(), reviews_per_day=20)
    voc = {c["id"]: c["bonus"] for c in cards if c["kind"] == "vocabulary"}
    assert voc.get("voc_V3") is True and sum(1 for b in voc.values() if not b) == 1
    assert set(voc) <= {"voc_V3", next(i for i, b in voc.items() if not b)}              # V1/V2 (unstarted) never ride along


def test_capped_items_rank_last_whatever_their_priority(db):
    class E:
        def __init__(self, id): self.id = id
    items = [E("a"), E("b"), E("c")]
    prio = {"a": 9.0, "b": 1.0, "c": 5.0}
    assert [e.id for e in order_bucket(items, lambda e: prio[e.id], {}, set(), frozenset({"a"}))] == ["c", "b", "a"]


def test_priority_inputs_report_the_day_gain_cap(db):
    seed(db)
    sv = ScoreService()
    sv.record(U, "gram_G0", "recognition", 1.0, "typed")
    now = datetime.now()
    assert not sv.priority_inputs(U, ["gram_G0"], now, now.date())["gram_G0"].capped
    sv.record(U, "gram_G0", "recognition", 1.0, "typed")
    pi = sv.priority_inputs(U, ["gram_G0"], now, now.date())["gram_G0"]
    assert pi.capped and pi.lapses == 0 and pi.stability > 0


def test_queue_route_takes_a_scope_and_rejects_a_bad_one(app, db):
    from lapp.services.auth import AuthService
    seed(db)
    c = app.test_client()
    c.set_cookie("session_token", AuthService().create_session(U, remember=False))
    ok = c.get(f"/api/review/{L}/queue?scope=lesson&lesson_id=lesson_L1")
    assert ok.status_code == 200 and {x["lesson_id"] for x in ok.get_json()} == {"lesson_L1"}
    assert c.get(f"/api/review/{L}/queue?scope=lesson").status_code == 400            # id missing
    assert c.get(f"/api/review/{L}/queue?scope=nope").status_code == 400
    assert c.get(f"/api/review/{L}").status_code == 200                                  # the daily alias


def test_a_course_without_calligraphy_serves_none(db):
    from lapp.models.system_data import CourseSetting
    seed(db)
    lesson = Scope("lesson", lesson_id="lesson_L2")
    assert any(c["id"].startswith("call_") for c in queue(lesson))
    with db.session_scope() as s:
        db.insert(CourseSetting(id="cs_1", user_id=U, language_id=L, key="element_types", value=["vocabulary", "grammar", "exercises"]), session=s, commit=False)
    cards = queue(lesson)
    assert cards and not any(c["id"].startswith("call_") for c in cards)
