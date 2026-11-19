import random
from collections import Counter

from lapp.models.system_data import User
from lapp.models.containers import Language, Lesson
from lapp.models.components import Word, Character
from lapp.models.features import Vocabulary, Grammar, Calligraphy
from lapp.services.exercise_generation.planner import PoolItem, offerable_types, plan_slots, plan_slots_from_mix, suggest_count
from lapp.services.exercise_generation.pool import lesson_pool
from lapp.services.ingestion.elements import EXERCISE_TYPES
from lapp.services.system_data import ScoreService


def _pool(n=5, score=50.0):
    """n vocabulary and two grammars: every slot is anchored on a grammar (EG-15)."""
    return [PoolItem("vocabulary", f"voc_V{i}", f"w{i}", score) for i in range(n)] + [PoolItem("grammar", f"gram_G{i}", f"g{i}", score) for i in range(2)]


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


SIZES = {"matching": (2, 4), "reading": (3, 5), "conversation": (2, 4)}      # the other types: the anchor and at most one companion


def test_multi_item_slots_hold_a_few_elements_and_the_others_one():
    for s in plan_slots(_pool(10), 300, None, True, random.Random(4)):
        low, high = SIZES.get(s.exercise_type, (1, 2))
        assert low <= len(s.items) <= high, (s.exercise_type, len(s.items))
        assert len({i.id for i in s.items}) == len(s.items)


def test_a_small_pool_caps_the_slot_size():
    for s in plan_slots(_pool(2), 50, None, True, random.Random(4)):
        assert len(s.items) <= 3         # the anchor grammar and the two vocabularies


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


def test_mix_plan_has_exactly_the_mix_counts():
    mix = {"quizz": 3, "dictation": 1, "reading": 2}
    slots = plan_slots_from_mix(_pool(), mix, random.Random(1))
    assert Counter(s.exercise_type for s in slots) == mix


def test_mix_plan_anchors_every_slot_on_a_grammar():
    pool = [PoolItem("calligraphy", f"call_C{i}", f"c{i}", 50.0) for i in range(4)] + [PoolItem("grammar", "gram_G0", "g", 50.0)]
    slots = plan_slots_from_mix(pool, {"quizz": 2, "answering": 1, "essay": 1}, random.Random(1))
    assert Counter(s.exercise_type for s in slots) == {"quizz": 2, "answering": 1, "essay": 1}
    assert all(s.items[0].id == "gram_G0" for s in slots)
    assert all(i.kind != "calligraphy" for s in slots if s.exercise_type == "essay" for i in s.items)     # a single character fits only some types


def test_every_slot_starts_with_an_own_grammar():
    for s in plan_slots(_pool(8), 40, None, True, random.Random(7)):
        assert s.items[0].kind == "grammar" and s.items[0].own
        assert all(i.kind != "grammar" for i in s.items[1:])


def test_every_grammar_is_covered_weakest_first():
    pool = [PoolItem("grammar", "gram_weak", "a", 0.0), PoolItem("grammar", "gram_strong", "b", 90.0), PoolItem("vocabulary", "voc_V", "v", 10.0)]
    assert {s.items[0].id for s in plan_slots(pool, 2, None, True, random.Random(1))} == {"gram_weak", "gram_strong"}
    assert [s.items[0].id for s in plan_slots(pool, 1, None, True, random.Random(1))] == ["gram_weak"]


def test_a_borrowed_grammar_never_anchors_and_no_grammar_means_no_slot():
    borrowed = [PoolItem("grammar", "gram_other", "g", 0.0, own=False), PoolItem("vocabulary", "voc_V", "v", 0.0)]
    assert plan_slots(borrowed, 5, None, True, random.Random(1)) == []
    assert plan_slots_from_mix(borrowed, {"quizz": 2}, random.Random(1)) == []
    assert plan_slots([p for p in _pool() if p.kind != "grammar"], 5, None, True) == []


def test_a_matching_slot_keeps_its_grammar_first():
    slots = plan_slots_from_mix(_pool(6), {"matching": 5}, random.Random(2))
    assert all(s.items[0].kind == "grammar" and len(s.items) >= 2 for s in slots)


def test_pool_marks_borrowed_elements(db):
    _seed(db, own=2, other=3)
    with db.session_scope() as s:
        pool = {p.id: p for p in lesson_pool("lesson_A", "user_U1", s)}
    assert pool["gram_G0"].own and pool["voc_V0"].own and not pool["voc_V2"].own


def test_mix_plan_empty_pool_or_mix():
    assert plan_slots_from_mix([], {"quizz": 2}) == [] and plan_slots_from_mix(_pool(), {}) == []


def test_offerable_types():
    types = offerable_types({"quizz": "ban"}, False)
    assert "quizz" not in types and "dictation" not in types and "translate" in types


def test_lesson_level_is_the_languages_own_label(db):
    from lapp.core.languages import language_for_iso2
    from lapp.services.exercise_generation.jobs import lesson_level
    _seed(db)
    with db.session_scope() as s:
        assert lesson_level("lesson_A", s) == language_for_iso2("jpn").levels[1]
        assert lesson_level("lesson_missing", s) is None
