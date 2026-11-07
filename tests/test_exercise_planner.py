import random
from collections import Counter

from lapp.models.system_data import User
from lapp.models.containers import Language, Lesson
from lapp.models.components import Word, Character
from lapp.models.features import Vocabulary, Grammar, Calligraphy
from lapp.services.exercise_generation.planner import PoolItem, plan_slots, suggest_count
from lapp.services.exercise_generation.pool import lesson_pool
from lapp.services.ingestion.elements import EXERCISE_TYPES
from lapp.services.system_data import ScoreService


def _pool(n=5, score=50.0):
    return [PoolItem("vocabulary", f"voc_V{i}", f"w{i}", score) for i in range(n)]


def test_suggest_count_ratios_floor_and_cap():
    assert suggest_count(10, 3, 4) == 13          # 5 + 6 + 2
    assert suggest_count(1, 0, 0) == 6            # floor
    assert suggest_count(200, 0, 0) == 60         # cap


def test_plan_returns_count_slots_and_nothing_for_an_empty_pool_or_all_banned():
    assert len(plan_slots(_pool(), 12, None, True, random.Random(1))) == 12
    assert plan_slots([], 5, None, True) == []
    assert plan_slots(_pool(), 5, {t: "ban" for t in EXERCISE_TYPES}, True) == []


def test_banned_types_and_dictation_without_tts_never_appear():
    slots = plan_slots(_pool(), 200, {"quizz": "ban"}, False, random.Random(1))
    kinds = {s.exercise_type for s in slots}
    assert "quizz" not in kinds and "dictation" not in kinds and len(kinds) > 5


def test_boost_raises_a_types_share():
    base = Counter(s.exercise_type for s in plan_slots(_pool(), 1300, None, True, random.Random(2)))
    boosted = Counter(s.exercise_type for s in plan_slots(_pool(), 1300, {"essay": "boost"}, True, random.Random(2)))
    assert boosted["essay"] > base["essay"]


def test_every_item_is_covered_and_weak_ones_get_more():
    pool = [PoolItem("vocabulary", "voc_weak", "a", 0.0), PoolItem("vocabulary", "voc_strong", "b", 100.0), PoolItem("grammar", "gram_G", "g", 50.0)]
    slots = plan_slots(pool, 150, None, True, random.Random(3))
    first = Counter(s.items[0].id for s in slots)
    assert set(first) == {"voc_weak", "voc_strong", "gram_G"}
    assert first["voc_weak"] > first["voc_strong"]
    assert {i.id for s in plan_slots(pool, 3, None, True, random.Random(3)) for i in s.items} >= {"voc_weak", "voc_strong", "gram_G"}


SIZES = {"matching": (2, 4), "reading": (3, 5), "conversation": (2, 4)}


def test_multi_item_slots_hold_a_few_elements_and_the_others_one():
    for s in plan_slots(_pool(10), 300, None, True, random.Random(4)):
        low, high = SIZES.get(s.exercise_type, (1, 1))
        assert low <= len(s.items) <= high, (s.exercise_type, len(s.items))
        assert len({i.id for i in s.items}) == len(s.items)


def test_a_small_pool_caps_the_slot_size():
    for s in plan_slots(_pool(2), 50, None, True, random.Random(4)):
        assert len(s.items) <= 2


def test_every_batch_of_four_or_more_has_a_reading_unless_it_is_banned():
    for seed in range(40):
        kinds = [s.exercise_type for s in plan_slots(_pool(8), 6, None, True, random.Random(seed))]
        assert "reading" in kinds, seed
    banned = [s.exercise_type for s in plan_slots(_pool(8), 6, {"reading": "ban"}, True, random.Random(1))]
    assert "reading" not in banned


def test_reading_is_weighted_above_a_plain_type():
    kinds = Counter(s.exercise_type for s in plan_slots(_pool(8), 1300, None, True, random.Random(5)))
    assert kinds["reading"] > kinds["essay"] * 1.4


def _seed(db, own=2, other=3):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id="user_U1", name="J", target_iso639_2t="jpn"), session=s, commit=False)
        for lid, level in (("lesson_A", 1), ("lesson_B", 1), ("lesson_C", 2)):
            db.insert(Lesson(id=lid, user_id="user_U1", language_id="lang_L1", title=lid, position=0, level=level), session=s, commit=False)
        db.insert(Word(id="word_X", language_id="lang_L1", word="x"), session=s, commit=False)
        db.insert(Vocabulary(id="voc_other_level", lesson_id="lesson_C", word_id="word_X"), session=s, commit=False)
        for i in range(own + other):
            lesson = "lesson_A" if i < own else "lesson_B"
            db.insert(Word(id=f"word_W{i}", language_id="lang_L1", word=f"w{i}"), session=s, commit=False)
            db.insert(Vocabulary(id=f"voc_V{i}", lesson_id=lesson, word_id=f"word_W{i}"), session=s, commit=False)
        db.insert(Grammar(id="gram_G0", lesson_id="lesson_A", title="g", explanation="e"), session=s, commit=False)
        db.insert(Character(id="char_C0", language_id="lang_L1", character="日"), session=s, commit=False)
        db.insert(Calligraphy(id="call_C0", lesson_id="lesson_A", character_id="char_C0"), session=s, commit=False)


def test_pool_of_a_thin_lesson_borrows_same_level_elements(db):
    _seed(db, own=2, other=3)
    ScoreService().set("user_U1", "voc_V0", score=80.0, difficulty=0.5, touch=False)
    with db.session_scope() as s:
        pool = lesson_pool("lesson_A", "user_U1", s)
    ids = {p.id for p in pool}
    assert {"voc_V0", "voc_V1", "gram_G0", "call_C0"} <= ids and {"voc_V2", "voc_V3", "voc_V4"} & ids
    assert "voc_other_level" not in ids
    assert {p.id: p for p in pool}["voc_V0"].score == 80.0 and {p.id: p for p in pool}["voc_V1"].score == 0.0
    assert {p.id: p.label for p in pool}["call_C0"] == "日"


def test_pool_of_a_rich_lesson_stays_inside_the_lesson(db):
    _seed(db, own=7, other=2)
    with db.session_scope() as s:
        assert not {p.id for p in lesson_pool("lesson_A", "user_U1", s)} & {"voc_V7", "voc_V8"}
