import pytest

from lapp.services.ingestion.extract import RawItem
from lapp.services.ingestion.types import Chunk
from lapp.services.ingestion.verify import normalise, verify
from lapp.services.parsing.types import Word


def _chunk(text, trust="native", words=None):
    return Chunk(id="p0c0", page=3, text=text, trust=trust, words=words or [])


def _item(word="apple", quote="apple - manzana", translation="manzana", **kw):
    return RawItem(word=word, quote=quote, translation=translation, **kw)


def _verify(item, chunk, iso1="en", lookup=lambda w: None):
    return verify(item, chunk, iso1, lookup)


def _codes(cand):
    return {f.code for f in cand.flags}


def test_fully_supported_native_item_is_verified():
    cand = _verify(_item(), _chunk("apple - manzana\nhouse - casa"))
    assert (cand.status, cand.flags, cand.min_conf, cand.page, cand.chunk_id) == ("verified", [], None, 3, "p0c0")
    assert cand.word == "apple" and cand.quote == "apple - manzana" and cand.id


def test_invented_word_is_flagged_but_still_returned():
    cand = _verify(_item(word="banana", quote="banana - platano"), _chunk("apple - manzana"))
    assert cand.status == "flagged"
    assert {"word_not_in_source", "quote_not_in_source"} <= _codes(cand)


def test_quote_missing_but_word_present():
    cand = _verify(_item(quote="apple is a fruit"), _chunk("apple - manzana"))
    assert _codes(cand) == {"quote_not_in_source"}


def test_translation_not_in_source_is_flagged():
    cand = _verify(_item(translation="pomme"), _chunk("apple - manzana"))
    assert _codes(cand) == {"translation_not_in_source"}


def test_no_translation_is_not_a_flag():
    assert _verify(_item(translation=None), _chunk("apple - manzana")).status == "verified"


def test_cjk_word_matches_across_source_spacing():
    chunk = _chunk("本 册 说 明\n苹 果 apple")
    cand = _verify(_item(word="苹果", quote="苹果 apple", translation="apple"), chunk, iso1="zh")
    assert cand.status == "verified"


def test_case_and_unicode_form_are_normalised():
    assert normalise("Ｃafé  É") == normalise("CAFÉ é") == "caféé"


def test_low_confidence_characters_flag_the_item_and_set_min_conf():
    words = [Word(text="apple", bbox=(0, 0, 1, 1), conf=0.3), Word(text="-", bbox=(0, 0, 1, 1), conf=0.99),
             Word(text="manzana", bbox=(0, 0, 1, 1), conf=0.98)]
    cand = _verify(_item(), _chunk("apple - manzana", "ocr", words))
    assert _codes(cand) == {"low_ocr_confidence"} and cand.min_conf == pytest.approx(0.3)


def test_confidence_only_counts_the_characters_of_the_word():
    words = [Word(text="apple", bbox=(0, 0, 1, 1), conf=0.99), Word(text="blurry", bbox=(0, 0, 1, 1), conf=0.2)]
    cand = _verify(_item(quote="apple", translation=None), _chunk("apple blurry", "ocr", words))
    assert cand.status == "verified" and cand.min_conf == pytest.approx(0.99)


def test_llm_transcribed_source_is_always_flagged():
    cand = _verify(_item(), _chunk("apple - manzana", "llm_transcribed"))
    assert _codes(cand) == {"llm_transcribed_source"}


def test_word_already_in_the_language_is_a_note_not_a_trust_problem():
    cand = _verify(_item(), _chunk("apple - manzana"), lookup=lambda w: "language")
    assert cand.status == "verified" and _codes(cand) == {"already_in_language"}
    assert cand.flags[0].severity == "info"


def test_word_already_in_this_lesson_is_a_warning():
    cand = _verify(_item(), _chunk("apple - manzana"), lookup=lambda w: "lesson")
    assert cand.status == "flagged" and _codes(cand) == {"already_in_lesson"}
    assert cand.flags[0].severity == "warning"


def test_trust_flags_still_flag_when_the_word_also_exists():
    cand = _verify(_item(word="banana", quote="banana"), _chunk("apple - manzana"), lookup=lambda w: "language")
    assert cand.status == "flagged" and {"word_not_in_source", "already_in_language"} <= _codes(cand)


def test_chinese_phonetic_syllables_must_match():
    chunk = _chunk("北京 Beijing")
    ok = _verify(_item(word="北京", quote="北京 Beijing", translation="Beijing", phonetic="Běi jīng"), chunk, "zh")
    toneless = _verify(_item(word="北京", quote="北京 Beijing", translation="Beijing", phonetic="beijing"), chunk, "zh")
    wrong = _verify(_item(word="北京", quote="北京 Beijing", translation="Beijing", phonetic="shanghai"), chunk, "zh")
    assert ok.status == "verified" and toneless.status == "verified"
    assert _codes(wrong) == {"phonetic_mismatch"}


def test_phonetic_is_not_checked_for_latin_languages():
    assert _verify(_item(phonetic="whatever"), _chunk("apple - manzana"), "en").status == "verified"


def test_translation_split_across_columns_is_not_flagged():
    text = "1. apple n. a fruit, to eat\nB: Hello there a red thing\nraw"  # "to eat raw" is wrapped around another column
    cand = _verify(_item(translation="a fruit, to eat raw", quote="apple n. a fruit, to eat"), _chunk(text))
    assert "translation_not_in_source" not in _codes(cand)
