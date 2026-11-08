"""Review queue honoring layout sections, goals, boost/ban and the vocabulary side pattern."""
import pytest

from lapp.models.system_data import User
from lapp.models.containers import Language, Lesson
from lapp.models.components import Word, Character
from lapp.models.features import Vocabulary, Grammar, Calligraphy, Exercise
from lapp.schemas.system_data.user_preferences import UserPreferencesDict
from lapp.services import ReviewService
from lapp.services.features import StudyGoalService
from lapp.services.features.review import order_bucket, section_budgets
from lapp.services.system_data import ScoreService, UserPreferencesService


class E:   # tiny stand-in element for order_bucket
    def __init__(self, id): self.id = id


MEAN = {"voc": 8, "gram": 90, "ex": 60, "call": 15}


def test_section_budgets():
    layout = [{"type": t, "minutes": None} for t in ("voc", "gram", "ex", "call")]
    assert section_budgets(layout, 20, MEAN) == {"voc": 38, "gram": 3, "ex": 5, "call": 20}   # 300 s each / 8, 90, 60, 15 s
    layout[0]["minutes"] = 1
    assert section_budgets(layout, 20, MEAN)["voc"] == 8


def test_budget_uses_type_cost():
    layout = [{"type": t} for t in ("voc", "call", "gram", "ex")]
    assert section_budgets(layout, 10, MEAN) == {"voc": 19, "call": 10, "gram": 2, "ex": 2}   # 150 s each


def test_budget_never_below_one():
    assert section_budgets([{"type": "gram"}], 1, MEAN)["gram"] == 1


def test_no_layout_is_capped_by_seconds_not_a_flat_count(db):
    _seed(db, vocs=40)
    _prefs(daily_goal_minutes=10)
    StudyGoalService().upsert("user_U1", "lang_L1", "week", 40, 0, 0)          # a menu supplies the 40 words
    n = len(_cards())
    assert 20 < n <= 600 // 8       # ~74 vocabulary cards fit in 10 min, not the old flat 20 (30 s each)


def test_order_bucket_goal_then_priority_with_boost():
    items = [E("a"), E("b"), E("c"), E("d")]
    pri = {"a": 4.0, "b": 3.0, "c": 1.0, "d": 2.5}
    out = order_bucket(items, lambda e: pri[e.id], goal_rank={"c": 2}, boosted_ids={"d"})
    assert [e.id for e in out] == ["c", "a", "d", "b"]        # d: 2.5 * 1.5 = 3.75 beats b (3.0), not a (4.0)
    ranked = order_bucket(items, lambda e: pri[e.id], goal_rank={"b": 1, "c": 2}, boosted_ids=set())
    assert [e.id for e in ranked][:2] == ["c", "b"]            # new goal items, then review goal items, then the rest


def _seed(db, vocs=0, grams=0, exs=(), calls=0):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id="user_U1", name="J", target_iso639_2t="jpn"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="L", position=0), session=s, commit=False)
        for i in range(vocs):
            db.insert(Word(id=f"word_W{i}", language_id="lang_L1", word=f"w{i}"), session=s, commit=False)
            db.insert(Vocabulary(id=f"voc_V{i}", lesson_id="lesson_L1", word_id=f"word_W{i}"), session=s, commit=False)
        for i in range(grams):
            db.insert(Grammar(id=f"gram_G{i}", lesson_id="lesson_L1", title=f"g{i}", explanation="e"), session=s, commit=False)
        for i in range(calls):
            db.insert(Character(id=f"char_C{i}", language_id="lang_L1", character=f"c{i}"), session=s, commit=False)
            db.insert(Calligraphy(id=f"call_C{i}", lesson_id="lesson_L1", character_id=f"char_C{i}"), session=s, commit=False)
        for i, t in enumerate(exs):
            db.insert(Exercise(id=f"ex_E{i}", lesson_id="lesson_L1", exercise_type=t, question="q", answer="a"), session=s, commit=False)


def _prefs(**kw):
    UserPreferencesService().create(UserPreferencesDict(user_id="user_U1", **kw))


def _cards(): return ReviewService().get_review_cards(language_id="lang_L1", user_id="user_U1", as_dict=True)


def test_layout_orders_and_omits_sections(db):
    _seed(db, vocs=2, grams=2, exs=("quizz", "quizz"))
    _prefs(review_layout=[{"type": "ex", "minutes": None}, {"type": "voc", "minutes": None}])
    cards = _cards()
    sections = [c["section"] for c in cards]
    assert sections == ["ex"] * 2 + ["voc"] * 4          # 2 exercises, 2 vocabularies x 2 sides; no grammar
    assert all("title" not in c for c in cards)


def test_ban_by_type_and_exercise_beats_boost(db):
    _seed(db, exs=("essay", "quizz", "quizz"))
    _prefs(exercise_type_prefs={"essay": "ban", "quizz": "boost"})
    from lapp.services.system_data import ExerciseUserPrefService
    ExerciseUserPrefService().set("user_U1", "ex_E2", "ban")
    assert [c["id"] for c in _cards()] == ["ex_E1"]


def test_side_pattern_cycle(db):
    _seed(db, vocs=3)
    _prefs(voc_side_pattern={"mode": "cycle", "cycle": ["F", "F", "B"]})
    assert [c["side"] for c in _cards()][:3] == ["front", "front", "back"]


def test_goal_items_are_served_first(db):
    _seed(db, vocs=3)
    ScoreService().record_side("user_U1", "voc_V0", "front", 1.0)      # V0 is reviewed, so not "new"
    ScoreService().record_side("user_U1", "voc_V0", "back", 1.0)
    StudyGoalService().upsert("user_U1", "lang_L1", "week", 1, 0, 0)
    first = _cards()[0]
    assert first["id"] == "voc_V1"                                     # the one picked new vocabulary


def test_mastered_goal_item_not_forced(db):
    _seed(db, vocs=2)
    ScoreService().set("user_U1", "voc_V1", score=10.0, difficulty=0.5, touch=False)   # seen before: a review slot
    StudyGoalService().upsert("user_U1", "lang_L1", "week", 1, 0, 0, r_vocabulary=1)  # menu: V0 new, V1 review
    for sid in ("voc_V0", "voc_V0#front", "voc_V0#back"):
        ScoreService().set("user_U1", sid, score=90.0, difficulty=0.5)               # V0 mastered
    assert {c["id"] for c in _cards()} == {"voc_V1"}


def test_menu_locks_the_type_to_new_then_review(db):
    _seed(db, vocs=4)
    ScoreService().set("user_U1", "voc_V3", score=30.0, difficulty=0.5, touch=False)  # seen earlier
    StudyGoalService().upsert("user_U1", "lang_L1", "week", 1, 0, 0)                   # 1 new, no review
    assert {c["id"] for c in _cards()} == {"voc_V0"}                                   # V1, V2 unseen, V3 not on the menu
    StudyGoalService().upsert("user_U1", "lang_L1", "week", 1, 0, 0, r_vocabulary=1)   # applies next period only
    assert {c["id"] for c in _cards()} == {"voc_V0"}


def test_new_elements_come_before_review_ones(db):
    _seed(db, vocs=3)
    ScoreService().set("user_U1", "voc_V2", score=30.0, difficulty=0.5, touch=False)
    StudyGoalService().upsert("user_U1", "lang_L1", "week", 1, 0, 0, r_vocabulary=1)
    cards = _cards()
    assert {c["id"] for c in cards} == {"voc_V0", "voc_V2"}
    assert cards[0]["id"] == "voc_V0"                                      # the new element leads


def test_no_goal_does_not_lock(db):
    _seed(db, vocs=3)
    assert {c["id"] for c in _cards()} == {"voc_V0", "voc_V1", "voc_V2"}


def test_split_fills_the_budget_with_fronts_then_the_same_backs(db):
    _seed(db, vocs=30)
    StudyGoalService().upsert("user_U1", "lang_L1", "week", 30, 0, 0)
    _prefs(daily_goal_minutes=5, voc_side_pattern={"mode": "split"})   # 300 s / 8 s = 37 cards -> 18 words
    cards = _cards()
    assert [c["side"] for c in cards] == ["front"] * 18 + ["back"] * 18
    assert [c["id"] for c in cards[:18]] == [c["id"] for c in cards[18:]]


@pytest.mark.parametrize("pattern", [None, {"mode": "cycle", "cycle": ["F", "F", "B"]}, {"mode": "random", "front": 3, "back": 1}, {"mode": "split"}])
def test_both_sides_of_a_vocabulary_are_always_reviewed_together(db, pattern):
    _seed(db, vocs=30, grams=30)
    _prefs(daily_goal_minutes=5, voc_side_pattern=pattern)               # 10 cards shared with grammar: a tight budget
    sides = {}
    for c in _cards():
        if "side" in c:
            sides.setdefault(c["id"], []).append(c["side"])
    assert sides and all(sorted(v) == ["back", "front"] for v in sides.values())


def test_exercises_only_from_lessons_of_reviewed_elements(db):
    _seed(db, vocs=1, exs=("quizz",))
    with db.session_scope() as s:
        db.insert(Lesson(id="lesson_L2", user_id="user_U1", language_id="lang_L1", title="L2", position=1), session=s, commit=False)
        db.insert(Exercise(id="ex_OTHER", lesson_id="lesson_L2", exercise_type="quizz", question="q", answer="a"), session=s, commit=False)
    ids = {c["id"] for c in _cards()}
    assert "ex_E0" in ids and "ex_OTHER" not in ids                     # L2 has no element under review


def test_exercises_alone_still_review(db):
    _seed(db, exs=("quizz",))
    assert [c["id"] for c in _cards()] == ["ex_E0"]


def test_null_prefs_keep_round_robin(db):
    _seed(db, vocs=1, grams=1, calls=1, exs=("quizz",))
    cards = _cards()
    assert {c["section"] for c in cards} == {None}
    assert len(cards) == 5          # 2 vocabulary sides + grammar + calligraphy + exercise


def test_all_banned_returns_empty(db):
    _seed(db, exs=("translate",))
    _prefs(exercise_type_prefs={"essay": "ban"})
    assert _cards() == []


def test_review_creates_the_suggested_goal_and_follows_its_menu(db):
    _seed(db, vocs=40)
    _prefs(daily_goal_minutes=20)
    assert StudyGoalService().get("user_U1", "lang_L1") is None
    ids = {c["id"] for c in _cards()}
    goal = StudyGoalService().get("user_U1", "lang_L1")
    assert goal and goal["auto"] is True
    assert len(ids) == goal["n_vocabulary"]                        # only the menu's 20 words, not the 40


def test_without_preferences_new_elements_come_from_the_default_window(db):
    """No goal and no preferences to size one: first 10 voc / 5 gram / 10 call (lesson order), seen ones as before."""
    _seed(db, vocs=25, grams=12, calls=25)
    ids = [c["id"] for c in _cards()]
    assert len({i for i in ids if i.startswith("voc_")}) == 10
    assert len({i for i in ids if i.startswith("gram_")}) == 5
    assert len({i for i in ids if i.startswith("call_")}) == 10
    assert StudyGoalService().get("user_U1", "lang_L1") is None


def test_without_preferences_seen_elements_outside_the_window_still_come_back(db):
    _seed(db, vocs=25)
    ScoreService().set("user_U1", "voc_V24", score=30.0, difficulty=0.5)       # seen: a review candidate, not "new"
    ids = {c["id"] for c in _cards()}
    assert "voc_V24" in ids and len(ids) == 11


def _short_exercises(db, n):
    with db.session_scope() as s:
        for i in range(n):
            db.insert(Exercise(id=f"ex_S{i}", lesson_id="lesson_L1", exercise_type="translate", question=f"say {i}", answer="ok"), session=s, commit=False)


def test_one_sentence_exercises_fill_the_section(db):
    _seed(db, vocs=1)
    _short_exercises(db, 30)
    _prefs(daily_goal_minutes=10, review_layout=[{"type": t, "minutes": None} for t in ("voc", "gram", "ex", "call")])
    cards = _cards()
    assert sum(c["section"] == "ex" for c in cards) >= 6          # was 2 with a flat 60 s per exercise
    assert all("est_seconds" in c for c in cards)


def test_section_always_serves_its_first_card(db):
    _seed(db, exs=("translate",))
    with db.session_scope() as s:
        db.get_by_id(Exercise, "ex_E0", session=s).text_support = "word " * 1000      # ~5 min to read, in a 1 min section
    _prefs(daily_goal_minutes=1, review_layout=[{"type": "ex", "minutes": 1}])
    assert [c["section"] for c in _cards()] == ["ex"]


def test_idle_history_does_not_shrink_the_queue(db):
    from lapp.models.data_collection import ProgressTracking
    _seed(db, vocs=1)
    _short_exercises(db, 30)
    with db.session_scope() as s:
        db.insert(ProgressTracking(id="prog_idle", user_id="user_U1", language_id="lang_L1", element_type="exercise", element_id="ex_S0",
                                   element_status="reviewed", score_before=0, score_after=1, result=True, duration_ms=1_200_000), session=s, commit=False)
    _prefs(daily_goal_minutes=10, review_layout=[{"type": "ex", "minutes": None}])
    assert len(_cards()) >= 6
