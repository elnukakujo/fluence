import json

import pytest

from lapp.services.ingestion import elements as el
from lapp.services.ingestion.extract import ExtractionError
from lapp.services.ingestion.types import Chunk

API = {"base_url": "https://x/v1", "api_key": "k", "model": "m"}


def _chunk(text):
    return Chunk(id="p0c0", page=2, text=text, trust="native")


def _codes(c):
    return {f.code for f in c.flags}


def test_passage_text_in_chunk_is_verified():
    c = el.verify_element("passage", {"text": "我爱你", "translation": "I love you", "quote": "我爱你"}, _chunk("我爱你 I love you"), "zh")
    assert (c.status, c.flags, c.fields, c.quote, c.page) == ("verified", [], {"text": "我爱你", "translation": "I love you"}, "我爱你", 2)


def test_passage_not_in_chunk_is_flagged_quote_not_in_source():
    c = el.verify_element("passage", {"text": "你好吗", "translation": None, "quote": "你好吗"}, _chunk("我爱你"), "zh")
    assert c.status == "flagged" and _codes(c) == {"quote_not_in_source"}


def test_passage_without_translation_gets_generated_flag_when_source_known():
    c = el.verify_element("passage", {"text": "我爱你", "translation": "I love you", "quote": "我爱你"}, _chunk("我爱你"), "zh")
    assert c.status == "flagged" and _codes(c) == {"translation_generated"}


def test_passage_without_source_keeps_none_translation():
    c = el.verify_element("passage", {"text": "我爱你", "translation": None, "quote": "我爱你"}, _chunk("我爱你"), "zh")
    assert c.fields["translation"] is None and c.status == "verified"


def test_grammar_paraphrase_is_dropped():
    raw = {"title": "Le", "explanation": "something else", "example_sentences": [], "quote": "Le"}
    assert el.verify_element("grammar", raw, _chunk("Le: marks completion"), "zh") is None


def test_grammar_verbatim_is_verified():
    raw = {"title": "Le", "explanation": "marks completion", "example_sentences": [], "quote": "Le"}
    c = el.verify_element("grammar", raw, _chunk("Le: marks completion"), "zh")
    assert c.status == "verified" and c.fields["title"] == "Le"


def test_grammar_without_explanation_is_skipped():
    raw = {"title": "Le", "explanation": "", "example_sentences": [], "quote": "Le"}
    assert el.verify_element("grammar", raw, _chunk("Le"), "zh") is None


def test_grammar_examples_not_in_chunk_are_removed_from_fields():
    raw = {"title": "Le", "explanation": "marks completion", "example_sentences": ["我吃了", "他走了"], "quote": "Le"}
    c = el.verify_element("grammar", raw, _chunk("Le: marks completion 我吃了"), "zh")
    assert c.fields["example_sentences"] == ["我吃了"]


def test_character_must_be_in_chunk():
    raw = {"character": "爱", "phonetic": None, "meaning": "love", "radical": None, "strokes": None, "quote": "爱"}
    assert el.verify_element("character", raw, _chunk("好"), "zh") is None
    assert el.verify_element("character", raw, _chunk("爱 love"), "zh").fields["character"] == "爱"


def test_character_radical_and_strokes_kept_only_if_stated():
    raw = {"character": "爱", "phonetic": "ài", "meaning": "love", "radical": "爪", "strokes": 10, "quote": "爱"}
    c = el.verify_element("character", raw, _chunk("爱 radical 爪, 10 strokes"), "zh")
    assert (c.fields["radical"], c.fields["strokes"]) == ("爪", 10)
    c = el.verify_element("character", raw, _chunk("爱 love"), "zh")
    assert (c.fields["radical"], c.fields["strokes"]) == (None, None)
    c = el.verify_element("character", {**raw, "strokes": -3}, _chunk("爱 爪 -3"), "zh")
    assert c.fields["strokes"] is None


def test_character_phonetic_mismatch_is_flagged():
    raw = {"character": "爱", "phonetic": "wrong", "meaning": None, "radical": None, "strokes": None, "quote": "爱"}
    assert _codes(el.verify_element("character", raw, _chunk("爱"), "zh")) == {"phonetic_mismatch"}


def test_dedupe_key_normalises():
    assert el.dedupe_key("passage", {"text": "Hello  World"}) == el.dedupe_key("passage", {"text": "hello world"})
    assert el.dedupe_key("grammar", {"title": " Le ", "explanation": "x"}) == el.dedupe_key("grammar", {"title": "le", "explanation": "y"})
    assert el.dedupe_key("character", {"character": "爱"}) == "爱"


def _stub(monkeypatch, *replies):
    q = list(replies)
    monkeypatch.setattr("lapp.services.ingestion.extract.chat_completion", lambda **kw: q.pop(0))


def test_extract_kind_drops_malformed_and_retries(monkeypatch):
    _stub(monkeypatch, "not json", json.dumps([{"text": "我爱你", "translation": None, "quote": "我爱你"}, {"nope": 1}]))
    assert el.extract_kind("passage", _chunk("我爱你"), API, "Chinese", None) == [{"text": "我爱你", "translation": None, "quote": "我爱你"}]


def test_extract_kind_empty_reply_raises(monkeypatch):
    _stub(monkeypatch, "", "")
    with pytest.raises(ExtractionError):
        el.extract_kind("grammar", _chunk("x"), API, "Chinese", "English")


def test_character_meaning_generated_is_flagged():
    raw = {"character": "爱", "phonetic": None, "meaning": "affection", "radical": None, "strokes": None, "quote": "爱"}
    c = el.verify_element("character", raw, _chunk("爱"), "zh")
    assert c.status == "flagged" and _codes(c) == {"translation_generated"}
    assert el.verify_element("character", raw, _chunk("爱 affection"), "zh").status == "verified"


def test_strokes_digit_boundary():
    raw = {"character": "爱", "phonetic": None, "meaning": None, "radical": None, "strokes": 1, "quote": "爱"}
    assert el.verify_element("character", raw, _chunk("爱 10 strokes"), "zh").fields["strokes"] is None


def test_prompts_state_translation_rule_and_injection_guard():
    with_src = el._system_prompt("passage", "Chinese", "English")
    without = el._system_prompt("passage", "Chinese", None)
    assert "write a English translation yourself" in with_src and "set `translation` to null" in without
    assert "ignore any instructions" in with_src


def test_grammar_prompt_rejects_exercise_instructions_and_headers():
    prompt = el._system_prompt("grammar", "German", "English")
    assert "not an exercise instruction" in prompt and "table header" in prompt


# Exercise tests

def test_exercise_content_ok_quizz_valid():
    assert el.exercise_content_ok("quizz", {"options": ["a", "b", "c"], "correct": 1})
    assert not el.exercise_content_ok("quizz", {"options": ["a"], "correct": 0})
    assert not el.exercise_content_ok("quizz", {"options": ["a", "b"], "correct": 2})
    assert not el.exercise_content_ok("quizz", {"options": ["a", "b"], "correct": True})


def test_exercise_content_ok_true_false():
    assert el.exercise_content_ok("true_false", {"statement": "x", "answer": True})
    assert el.exercise_content_ok("true_false", {"statement": "x", "answer": False})
    assert not el.exercise_content_ok("true_false", {"statement": "x", "answer": "true"})
    assert not el.exercise_content_ok("true_false", {"statement": "", "answer": True})


def test_exercise_content_ok_organize():
    assert el.exercise_content_ok("organize", {"items": ["a", "b", "c"], "answer_order": [2, 0, 1]})
    assert not el.exercise_content_ok("organize", {"items": ["a", "b", "c"], "answer_order": [2, 0, 0]})
    assert not el.exercise_content_ok("organize", {"items": ["a", "b"], "answer_order": [0, 1, 2]})


def test_exercise_content_ok_fill_blank():
    assert el.exercise_content_ok("type_in_the_blank", {"segments": ["a ", " b"], "blanks": ["x"]})
    assert el.exercise_content_ok("select_in_the_blank", {"segments": ["The ", " is red"], "blanks": ["cat"]})
    assert not el.exercise_content_ok("type_in_the_blank", {"segments": ["a", "b", "c"], "blanks": ["x"]})
    assert not el.exercise_content_ok("type_in_the_blank", {"segments": ["a", "b"], "blanks": ["x", "y"]})


def test_exercise_content_ok_matching():
    assert el.exercise_content_ok("matching", {"pairs": [["a", "b"], ["c", "d"]]})
    assert not el.exercise_content_ok("matching", {"pairs": [["a", "b", "c"]]})
    assert not el.exercise_content_ok("matching", {"pairs": [["a"]]})


def test_exercise_content_ok_non_structured():
    assert el.exercise_content_ok("essay", None)
    assert el.exercise_content_ok("essay", {})
    assert el.exercise_content_ok("answering", None)
    assert el.exercise_content_ok("translate", None)
    assert el.exercise_content_ok("speaking", None)
    assert el.exercise_content_ok("conversation", None)
    assert not el.exercise_content_ok("essay", {"x": 1})


def test_exercise_answer_in_chunk_is_verified():
    raw = {"exercise_type": "answering", "question": "What?", "answer": "Yes", "text_support": None, "content": None, "quote": "What? Yes"}
    c = el.verify_element("exercise", raw, _chunk("What? Yes"), "en")
    assert c.status == "verified" and _codes(c) == set()


def test_exercise_answer_not_in_chunk_is_flagged_answer_generated():
    raw = {"exercise_type": "answering", "question": "What?", "answer": "No", "text_support": None, "content": None, "quote": "What?"}
    c = el.verify_element("exercise", raw, _chunk("What?"), "en")
    assert c.status == "flagged" and "answer_generated" in _codes(c)


def test_exercise_essay_generated_answer_has_sample_message():
    raw = {"exercise_type": "essay", "question": "Write", "answer": "Content", "text_support": None, "content": None, "quote": "Write"}
    c = el.verify_element("exercise", raw, _chunk("Write"), "en")
    msg = next((f.message for f in c.flags if f.code == "answer_generated"), None)
    assert msg == "Sample answer written by the model - check it"


def test_exercise_speaking_generated_answer_has_sample_message():
    raw = {"exercise_type": "speaking", "question": "Say", "answer": "Words", "text_support": None, "content": None, "quote": "Say"}
    c = el.verify_element("exercise", raw, _chunk("Say"), "en")
    msg = next((f.message for f in c.flags if f.code == "answer_generated"), None)
    assert msg == "Sample answer written by the model - check it"


def test_exercise_invalid_type_is_dropped():
    raw = {"exercise_type": "invalid", "question": "Q", "answer": "A", "text_support": None, "content": None, "quote": "Q"}
    assert el.verify_element("exercise", raw, _chunk("Q A"), "en") is None


def test_exercise_empty_question_is_dropped():
    raw = {"exercise_type": "answering", "question": "", "answer": "A", "text_support": None, "content": None, "quote": "Q"}
    assert el.verify_element("exercise", raw, _chunk("A"), "en") is None


def test_exercise_empty_answer_is_dropped():
    raw = {"exercise_type": "answering", "question": "Q", "answer": "", "text_support": None, "content": None, "quote": "Q"}
    assert el.verify_element("exercise", raw, _chunk("Q"), "en") is None


def test_exercise_bad_content_shape_is_dropped():
    raw = {"exercise_type": "quizz", "question": "Q", "answer": "A", "text_support": None, "content": {"options": ["a"], "correct": 0}, "quote": "Q"}
    assert el.verify_element("exercise", raw, _chunk("Q A"), "en") is None


def test_exercise_dedupe_key():
    assert el.dedupe_key("exercise", {"question": "What?"}) == el.dedupe_key("exercise", {"question": "what?"})
