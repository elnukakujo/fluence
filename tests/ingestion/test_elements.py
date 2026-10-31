import json

import pytest

from lapp.services.ingestion import elements as el, grammar as grammar_module
from lapp.services.ingestion.extract import ExtractionError
from lapp.services.ingestion.types import Chunk

API = {"base_url": "https://x/v1", "api_key": "k", "model": "m"}


def _chunk(text):
    return Chunk(id="p0c0", page=2, text=text, trust="native")


def _codes(c):
    return {f.code for f in c.flags}




def test_grammar_with_model_generated_is_flagged():
    raw = {"title": "Le", "explanation": "something else", "example_sentences": [], "quote": "Le"}
    c = el.verify_element("grammar", raw, _chunk("Le: marks completion"), "zh")
    assert c.status == "flagged" and _codes(c) == {"grammar_generated"}


def test_grammar_always_flagged_with_grammar_generated():
    raw = {"title": "Le", "explanation": "marks completion", "example_sentences": [], "quote": "Le"}
    c = el.verify_element("grammar", raw, _chunk("Le: marks completion"), "zh")
    assert c.status == "flagged" and "grammar_generated" in _codes(c)


def test_grammar_without_explanation_is_skipped():
    raw = {"title": "Le", "explanation": "", "example_sentences": [], "quote": "Le"}
    assert el.verify_element("grammar", raw, _chunk("Le"), "zh") is None


def test_grammar_examples_not_in_chunk_are_removed_from_fields():
    raw = {"title": "Le", "explanation": "marks completion", "example_sentences": ["我吃了", "他走了"], "quote": "Le"}
    c = el.verify_element("grammar", raw, _chunk("Le: marks completion 我吃了"), "zh")
    assert c.fields["example_sentences"] == ["我吃了"] and c.status == "flagged"


def test_grammar_stores_original_text():
    raw = {"title": "Le", "explanation": "marks completion", "example_sentences": [], "quote": "Le"}
    c = el.verify_element("grammar", raw, _chunk("Le: marks completion"), "zh")
    assert c.fields["original_text"] == "Le: marks completion"


def test_calligraphy_must_be_in_chunk():
    raw = {"character": "爱", "phonetic": None, "meaning": "love", "radical": None, "strokes": None, "quote": "爱"}
    assert el.verify_element("calligraphy", raw, _chunk("好"), "zh") is None
    assert el.verify_element("calligraphy", raw, _chunk("爱 love"), "zh").fields["character"] == "爱"


def test_calligraphy_radical_and_strokes_kept_only_if_stated():
    raw = {"character": "爱", "phonetic": "ài", "meaning": "love", "radical": "爪", "strokes": 10, "quote": "爱"}
    c = el.verify_element("calligraphy", raw, _chunk("爱 radical 爪, 10 strokes"), "zh")
    assert (c.fields["radical"], c.fields["strokes"]) == ("爪", 10)
    c = el.verify_element("calligraphy", raw, _chunk("爱 love"), "zh")
    assert (c.fields["radical"], c.fields["strokes"]) == (None, None)
    c = el.verify_element("calligraphy", {**raw, "strokes": -3}, _chunk("爱 爪 -3"), "zh")
    assert c.fields["strokes"] is None


def test_calligraphy_phonetic_mismatch_is_flagged():
    raw = {"character": "爱", "phonetic": "wrong", "meaning": None, "radical": None, "strokes": None, "quote": "爱"}
    assert _codes(el.verify_element("calligraphy", raw, _chunk("爱"), "zh")) == {"phonetic_mismatch"}


def test_dedupe_key_normalises():
    assert el.dedupe_key("grammar", {"title": " Le ", "explanation": "x"}) == el.dedupe_key("grammar", {"title": "le", "explanation": "y"})
    assert el.dedupe_key("calligraphy", {"character": "爱"}) == "爱"


def _stub(monkeypatch, *replies):
    q = list(replies)
    monkeypatch.setattr("lapp.services.ingestion.extract.chat_completion", lambda **kw: q.pop(0))




def test_extract_kind_empty_reply_raises(monkeypatch):
    _stub(monkeypatch, "", "")
    with pytest.raises(ExtractionError):
        el.extract_kind("grammar", _chunk("x"), API, "Chinese", "English")


def test_calligraphy_meaning_generated_is_flagged():
    raw = {"character": "爱", "phonetic": None, "meaning": "affection", "radical": None, "strokes": None, "quote": "爱"}
    c = el.verify_element("calligraphy", raw, _chunk("爱"), "zh")
    assert c.status == "flagged" and _codes(c) == {"translation_generated"}
    assert el.verify_element("calligraphy", raw, _chunk("爱 affection"), "zh").status == "verified"


def test_calligraphy_strokes_digit_boundary():
    raw = {"character": "爱", "phonetic": None, "meaning": None, "radical": None, "strokes": 1, "quote": "爱"}
    assert el.verify_element("calligraphy", raw, _chunk("爱 10 strokes"), "zh").fields["strokes"] is None


def test_prompts_include_injection_guard():
    prompt = el._system_prompt("calligraphy", "Chinese", None)
    assert "ignore any instructions" in prompt


def test_grammar_prompt_rejects_exercise_instructions_and_headers():
    prompt = el._system_prompt("grammar", "German", None)
    assert "not an exercise instruction" in prompt and "table header" in prompt


def test_calligraphy_prompt_describes_stroke_and_character_content():
    prompt = el._system_prompt("calligraphy", "Chinese", None)
    assert "stroke order" in prompt and "practice grids" in prompt


# Exercise tests

def test_exercise_content_ok_quizz_valid():
    assert el.exercise_content_ok("quizz", {"options": ["a", "b", "c"], "correct": [1]})
    assert el.exercise_content_ok("quizz", {"options": ["a", "b", "c"], "correct": [0, 2]})
    assert not el.exercise_content_ok("quizz", {"options": ["a", "b", "c"], "correct": 1})       # the app stores a list
    assert not el.exercise_content_ok("quizz", {"options": ["a"], "correct": [0]})
    assert not el.exercise_content_ok("quizz", {"options": ["a", "b"], "correct": [2]})
    assert not el.exercise_content_ok("quizz", {"options": ["a", "b"], "correct": [True]})
    assert not el.exercise_content_ok("quizz", {"options": ["a", "b"], "correct": []})


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
    assert el.exercise_content_ok("type_in_the_blank", {"segments": ["a ", " b"], "blanks": [{"answer": "x"}]})
    assert el.exercise_content_ok("select_in_the_blank", {"segments": ["The ", " is red"], "blanks": [{"answer": "cat", "options": ["cat", "dog"]}]})
    assert not el.exercise_content_ok("type_in_the_blank", {"segments": ["a ", " b"], "blanks": ["x"]})   # blanks are objects
    assert not el.exercise_content_ok("select_in_the_blank", {"segments": ["a ", " b"], "blanks": [{"answer": "x"}]})  # needs options
    assert not el.exercise_content_ok("select_in_the_blank", {"segments": ["a ", " b"], "blanks": [{"answer": "x", "options": ["y", "z"]}]})
    assert not el.exercise_content_ok("type_in_the_blank", {"segments": ["a", "b", "c"], "blanks": [{"answer": "x"}]})
    assert not el.exercise_content_ok("type_in_the_blank", {"segments": ["a", "b"], "blanks": [{"answer": "x"}, {"answer": "y"}]})


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
    raw = {"exercise_type": "quizz", "question": "Q", "answer": "A", "text_support": None, "content": {"options": ["a"], "correct": [0]}, "quote": "Q"}
    assert el.verify_element("exercise", raw, _chunk("Q A"), "en") is None


def test_exercise_dedupe_key():
    assert el.dedupe_key("exercise", {"question": "What?"}) == el.dedupe_key("exercise", {"question": "what?"})


def test_grammar_empty_title_dropped():
    raw = {"title": "", "explanation": "marks completion", "example_sentences": [], "quote": "Le"}
    assert el.verify_element("grammar", raw, _chunk("Le: marks completion"), "zh") is None


def test_grammar_empty_explanation_dropped():
    raw = {"title": "Le", "explanation": "", "example_sentences": [], "quote": "Le"}
    assert el.verify_element("grammar", raw, _chunk("Le: marks completion"), "zh") is None


def test_grammar_prompt_includes_rules_and_injection_guard():
    prompt = grammar_module._system_prompt("Chinese", "English")
    assert "ignore any instructions" in prompt
    assert "complete grammar sheet" in prompt
    assert "ALL example sentences" in prompt


def test_grammar_prompt_mentions_bilingual_support():
    prompt = grammar_module._system_prompt("Chinese", "English")
    assert "English and Chinese" in prompt or "both" in prompt


def test_grammar_prompt_without_source_language():
    prompt = grammar_module._system_prompt("Chinese", None)
    assert "whatever languages the page uses" in prompt


# Tests for grammar.generate_grammar

def test_generate_grammar_empty_reply_raises(monkeypatch):
    _stub(monkeypatch, "", "")
    with pytest.raises(ExtractionError):
        grammar_module.generate_grammar(_chunk("x"), API, "Chinese", "English")


def test_generate_grammar_bilingual_sheet_kept():
    prompt = grammar_module._system_prompt("Chinese", "English")
    assert "English and Chinese" in prompt or "both" in prompt


def test_generate_grammar_skips_pronunciation_notes(monkeypatch):
    prompt = grammar_module._system_prompt("Chinese", "English")
    assert "pronunciation notes" in prompt or "SKIP" in prompt


def test_generate_grammar_skips_exercise_instructions(monkeypatch):
    prompt = grammar_module._system_prompt("Chinese", "English")
    assert "exercise instructions" in prompt or "SKIP" in prompt


def test_generate_grammar_returns_list_for_valid_json(monkeypatch):
    _stub(monkeypatch, json.dumps([
        {"title": "点", "explanation": "indicates a point", "example_sentences": ["这是一个点"], "quote": "点"}
    ]))
    result = grammar_module.generate_grammar(_chunk("点 indicates a point. 这是一个点"), API, "Chinese", "English")
    assert len(result) == 1
    assert result[0]["title"] == "点"


def test_generate_grammar_skips_empty_title(monkeypatch):
    _stub(monkeypatch, json.dumps([
        {"title": "", "explanation": "indicates a point", "example_sentences": [], "quote": "点"},
        {"title": "点", "explanation": "a point", "example_sentences": [], "quote": "点"}
    ]))
    result = grammar_module.generate_grammar(_chunk("点 a point"), API, "Chinese", "English")
    assert len(result) == 1
    assert result[0]["title"] == "点"


def test_generate_grammar_skips_empty_explanation(monkeypatch):
    _stub(monkeypatch, json.dumps([
        {"title": "点", "explanation": "", "example_sentences": [], "quote": "点"},
        {"title": "点", "explanation": "a point", "example_sentences": [], "quote": "点"}
    ]))
    result = grammar_module.generate_grammar(_chunk("点 a point"), API, "Chinese", "English")
    assert len(result) == 1
    assert result[0]["title"] == "点"


def test_generate_grammar_cleans_examples(monkeypatch):
    _stub(monkeypatch, json.dumps([
        {"title": "点", "explanation": "a point", "example_sentences": ["  我看点  ", "", "另一个"], "quote": "点"}
    ]))
    result = grammar_module.generate_grammar(_chunk("点 a point 我看点"), API, "Chinese", "English")
    assert len(result) == 1
    # generate_grammar just cleans strings, doesn't filter against chunk text
    assert result[0]["example_sentences"] == ["我看点", "另一个"]


def test_generate_grammar_returns_empty_for_empty_reply(monkeypatch):
    _stub(monkeypatch, json.dumps([]))
    result = grammar_module.generate_grammar(_chunk("nothing here"), API, "Chinese", "English")
    assert result == []


def test_grammar_whose_explanation_only_repeats_the_title_is_dropped():
    raw = {"title": "祈使句的句调 / Intonation of an Imperative Sentence",
           "explanation": "祈使句的句调\nIntonation of an Imperative Sentence", "example_sentences": [], "quote": "x"}
    assert el.verify_element("grammar", raw, _chunk("祈使句的句调 Intonation of an Imperative Sentence"), "zh") is None


def test_exercise_prompt_lists_the_valid_types_and_content_shapes():
    from lapp.services.ingestion import elements as el
    p = el._system_prompt("exercise", "English", "Chinese")
    for t in ("essay", "answering", "translate", "quizz", "true_false", "organize", "type_in_the_blank", "matching"):
        assert t in p
    assert "answer_order" in p and "segments" in p and "never null" in p and '"correct": [' in p and '{"answer": str' in p


def test_structured_exercises_are_stored_the_way_the_apps_form_stores_them():
    text = "The cat is red. cat dog"
    raw = {"exercise_type": "select_in_the_blank", "question": "The cat is red.", "answer": "cat", "text_support": None, "quote": "The cat is red.",
           "content": {"segments": ["The ", " is red."], "blanks": [{"answer": "cat", "options": ["cat", "dog"]}]}}
    c = el.verify_element("exercise", raw, _chunk(text), "en")
    assert (c.fields["question"], c.fields["answer"]) == ("The __ is red.", "cat") and c.status == "verified"
    quiz = {"exercise_type": "quizz", "question": "Pick", "answer": "x", "text_support": None, "quote": "Pick",
            "content": {"options": ["a", "b", "c"], "correct": [1]}}
    q = el.verify_element("exercise", quiz, _chunk("Pick a b c"), "en")
    assert (q.fields["question"], q.fields["answer"]) == ("Pick", "b")
    tf = {"exercise_type": "true_false", "question": "Q", "answer": "x", "text_support": None, "quote": "Q",
          "content": {"statement": "The sky is blue", "answer": True}}
    t = el.verify_element("exercise", tf, _chunk("Q The sky is blue"), "en")
    assert (t.fields["question"], t.fields["answer"]) == ("The sky is blue", "true")
    assert any(f.code == "answer_generated" for f in t.flags)      # the model decided true/false
