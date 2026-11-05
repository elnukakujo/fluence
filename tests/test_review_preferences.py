"""Review queue honoring layout sections, goals, boost/ban and the vocabulary side pattern."""
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


def test_section_budgets():
    layout = [{"type": t, "minutes": None} for t in ("voc", "gram", "ex", "call")]
    assert section_budgets(layout, 20) == {"voc": 10, "gram": 10, "ex": 10, "call": 10}
    layout[0]["minutes"] = 1
    assert section_budgets(layout, 20)["voc"] == 2


def test_order_bucket_goal_then_priority_with_boost():
    items = [E("a"), E("b"), E("c"), E("d")]
    pri = {"a": 4.0, "b": 3.0, "c": 1.0, "d": 2.5}
    out = order_bucket(items, lambda e: pri[e.id], goal_ids={"c"}, boosted_ids={"d"})
    assert [e.id for e in out] == ["c", "a", "d", "b"]        # d: 2.5 * 1.5 = 3.75 beats b (3.0), not a (4.0)


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
    StudyGoalService().upsert("user_U1", "lang_L1", "week", 1, 0, 0)
    StudyGoalService().ensure_cycle("user_U1", "lang_L1")               # picks voc_V0
    ScoreService().set("user_U1", "voc_V0", score=90.0, difficulty=0.5)
    ScoreService().set("user_U1", "voc_V0#front", score=90.0, difficulty=0.5)
    ScoreService().set("user_U1", "voc_V0#back", score=90.0, difficulty=0.5)
    assert _cards()[0]["id"] != "voc_V0"


def test_null_prefs_keep_round_robin(db):
    _seed(db, vocs=1, grams=1, calls=1, exs=("quizz",))
    cards = _cards()
    assert {c["section"] for c in cards} == {None}
    assert len(cards) == 5          # 2 vocabulary sides + grammar + calligraphy + exercise


def test_all_banned_returns_empty(db):
    _seed(db, exs=("essay",))
    _prefs(exercise_type_prefs={"essay": "ban"})
    assert _cards() == []
