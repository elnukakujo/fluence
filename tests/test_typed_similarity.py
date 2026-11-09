import pytest

from lapp.services.features.study_constants import PHONETIC_SUB_COST
from lapp.utils.typed_similarity import closeness, diff


def test_identical_is_one():
    assert closeness("bonjour", "bonjour") == 1.0


def test_one_wrong_character_costs_one_over_len():
    assert closeness("bonjoux", "bonjour") == pytest.approx(1 - 1 / 7)


def test_same_sound_substitution_is_cheaper_zh():
    # 是 and 事 are both "shi" in pinyin (tones aside)
    assert closeness("事", "是", iso1="zh") == pytest.approx(1 - PHONETIC_SUB_COST)
    assert closeness("事", "是", iso1="zh", phonetic=False) == 0.0


def test_no_phonetic_support_is_plain_edit_distance():
    assert closeness("cat", "cut", iso1="en") == pytest.approx(1 - 1 / 3)


def test_empty_rules():
    assert closeness("", "") == 1.0
    assert closeness("a", "") == 0.0
    assert closeness("", "a") == 0.0


def test_case_width_punctuation_ignored():
    assert closeness("HELLO, World!", "hello world") == 1.0
    assert closeness("ＡＢＣ", "abc") == 1.0


def test_diff_lists_differing_expected_indices():
    assert diff("bonjoux", "bonjour") == [6]
    assert diff("bonjour", "bonjour") == []
    assert diff("bnjour", "bonjour") == [1]
