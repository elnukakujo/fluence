import pytest

from lapp.services.ingestion import elements as el
from lapp.services.ingestion.types import Chunk

API = {"base_url": "https://x/v1", "api_key": "k", "model": "m"}
CHUNK = Chunk(id="p0c0", page=0, text="page text", trust="native")


@pytest.fixture
def model(monkeypatch):
    """Queue replies for el._ask; records (system prompt, user text) of every call."""
    class Fake:
        replies, calls = [], []

    def fake(chunk, api, system, windowed=False):
        Fake.calls.append((system, chunk.text))
        r = Fake.replies.pop(0)
        if isinstance(r, Exception):
            raise r
        return r

    Fake.replies, Fake.calls = [], []
    monkeypatch.setattr(el, "_ask", fake)
    return Fake


def _block(hint, items, support=None, keys=None):
    return {"instruction": "Do it", "support_text": support, "items": items, "answer_key": keys, "type_hint": hint}


QUIZ = {"question": "Pick", "answer": "b", "content": {"options": ["a", "b"], "correct": [1]}, "quote": "Pick"}
TF = {"question": "Sky is blue", "answer": "true", "content": {"statement": "Sky is blue", "answer": True}, "quote": "Sky is blue"}


def test_split_then_one_build_call_per_block(model):
    model.replies = [[_block("quizz", ["Pick"]), _block("true_false", ["Sky is blue"])], QUIZ, TF]
    out = el.extract_exercises(CHUNK, API, "English", None)
    assert [o["exercise_type"] for o in out] == ["quizz", "true_false"] and len(model.calls) == 3
    quizz_prompt = model.calls[1][0]
    assert '"options"' in quizz_prompt and "answer_order" not in quizz_prompt


def test_support_text_is_copied_onto_every_item(model):
    model.replies = [[_block("quizz", ["Pick", "Pick again"], support="Passage")], QUIZ, QUIZ]
    assert [o["text_support"] for o in el.extract_exercises(CHUNK, API, "English", None)] == ["Passage", "Passage"]


def test_free_text_types_need_no_build_call(model):
    model.replies = [[_block("answering", ["Q1", "Q2"], keys=["A1", "A2"])]]
    out = el.extract_exercises(CHUNK, API, "English", None)
    assert [(o["question"], o["answer"], o["content"]) for o in out] == [("Q1", "A1", None), ("Q2", "A2", None)]
    assert len(model.calls) == 1


def test_unknown_type_hint_falls_back_to_answering(model):
    model.replies = [[_block("poem", ["Q1"])], {"answer": "A"}]
    assert el.extract_exercises(CHUNK, API, "English", None)[0]["exercise_type"] == "answering"


@pytest.mark.parametrize("reply", [[], [{"instruction": "x"}], [{"items": "nope"}], ["junk"]])
def test_split_replies_without_usable_items_give_nothing(model, reply):
    model.replies = [reply]
    assert el.extract_exercises(CHUNK, API, "English", None) == []


BAD_QUIZ = {"question": "Pick", "answer": "b", "content": {"options": ["a"], "correct": [0]}, "quote": "Pick"}


def test_invalid_content_is_retried_once_with_the_reason(model):
    model.replies = [[_block("quizz", ["Pick"])], BAD_QUIZ, QUIZ]
    out = el.extract_exercises(CHUNK, API, "English", None)
    assert out[0]["content"] == QUIZ["content"] and len(model.calls) == 3
    assert el.exercise_content_error("quizz", BAD_QUIZ["content"]) in model.calls[2][1]


def test_still_invalid_after_retry_is_kept_and_flagged(model):
    model.replies = [[_block("quizz", ["Pick"])], BAD_QUIZ, BAD_QUIZ]
    out = el.extract_exercises(CHUNK, API, "English", None)
    assert len(out) == 1 and out[0]["content"] is None and out[0]["exercise_type"] == "quizz"
    chunk = Chunk(id="c", page=0, text="Pick a b", trust="native")
    assert "content_invalid" in {f.code for f in el.verify_element("exercise", out[0], chunk, "en").flags}


def test_error_on_the_retry_keeps_the_item(model):
    model.replies = [[_block("quizz", ["Pick"])], BAD_QUIZ, el.ExtractionError("no json")]
    assert el.extract_exercises(CHUNK, API, "English", None)[0]["content"] is None


def test_empty_answer_gets_one_follow_up(model):
    model.replies = [[_block("answering", ["Q1"])], {"answer": "Written"}]
    out = el.extract_exercises(CHUNK, API, "English", None)
    assert out[0]["answer"] == "Written" and len(model.calls) == 2
    chunk = Chunk(id="c", page=0, text="Q1", trust="native")
    assert "answer_generated" in {f.code for f in el.verify_element("exercise", out[0], chunk, "en").flags}


def test_empty_follow_up_or_error_keeps_the_item_with_empty_answer(model):
    model.replies = [[_block("answering", ["Q1", "Q2"])], {"answer": ""}, el.ExtractionError("x")]
    assert [o["answer"] for o in el.extract_exercises(CHUNK, API, "English", None)] == ["", ""]


READING = {"question": "Read the dialogue", "answer": "", "quote": "A: こんにちは",
           "content": {"speakers": [{"name": "A"}, {"name": "B"}],
                       "lines": [{"speaker": "A", "text": "こんにちは", "translation": "Hello"},
                                 {"speaker": "B", "text": "やあ", "translation": None}]}}
DICTATION = {"question": "Write what you hear", "answer": "", "quote": "Write what you hear",
             "content": {"lines": [{"text": "犬がいます"}, {"text": "猫もいます"}]}}


def test_content_ok_for_reading_and_dictation():
    ok = el.exercise_content_ok
    assert ok("reading", READING["content"])
    assert ok("reading", {"speakers": [{"name": "A"}], "lines": [{"speaker": "A", "text": "x"}]})   # one speaker is fine
    assert not ok("reading", {"speakers": [{"name": "A"}], "lines": [{"speaker": "Z", "text": "x"}]})
    assert not ok("reading", {"speakers": [{"name": "A"}], "lines": []})
    assert not ok("reading", {"speakers": [{"name": "A"}], "lines": [{"speaker": "A", "text": " "}]})
    assert ok("dictation", DICTATION["content"])
    assert not ok("dictation", {"lines": []})


def test_reading_block_is_one_candidate(model):
    model.replies = [[_block("reading", ["A: こんにちは", "B: やあ"])], READING]
    out = el.extract_exercises(CHUNK, API, "Japanese", None)
    assert len(out) == 1 and out[0]["exercise_type"] == "reading" and len(model.calls) == 2
    assert "A: こんにちは" in model.calls[1][1] and "B: やあ" in model.calls[1][1]


def test_dictation_block_is_one_candidate(model):
    model.replies = [[_block("dictation", ["犬がいます", "猫もいます"])], DICTATION]
    out = el.extract_exercises(CHUNK, API, "Japanese", None)
    assert len(out) == 1 and out[0]["exercise_type"] == "dictation" and len(model.calls) == 2
    assert "犬がいます" in model.calls[1][1] and "猫もいます" in model.calls[1][1]


def _verify(raw, page_text):
    chunk = Chunk(id="p0c0", page=0, text=page_text, trust="native")
    return el.verify_element("exercise", {**raw, "exercise_type": raw["exercise_type"], "text_support": None}, chunk, "ja")


def test_reading_answer_is_joined_lines_and_not_generated():
    cand = _verify({**READING, "exercise_type": "reading"}, "Read the dialogue A: こんにちは B: やあ")
    assert cand.fields["answer"] == "こんにちは\nやあ"
    assert "answer_generated" not in {f.code for f in cand.flags}


def test_reading_stored_content_has_ids_and_null_audio():
    cand = _verify({**READING, "exercise_type": "reading"}, "Read the dialogue A: こんにちは B: やあ")
    c = cand.fields["content"]
    ids = [s["id"] for s in c["speakers"]]
    assert all(ids) and len(set(ids)) == 2
    assert all(l["audioIndex"] is None and l["speakerId"] in ids for l in c["lines"])
    assert [l["translation"] for l in c["lines"]] == ["Hello", None]


def test_dictation_answer_is_joined_lines_and_content_has_null_audio():
    cand = _verify({**DICTATION, "exercise_type": "dictation"}, "Write what you hear 犬がいます 猫もいます")
    assert cand.fields["answer"] == "犬がいます 猫もいます"
    assert cand.fields["content"]["lines"] == [{"text": "犬がいます", "audioIndex": None}, {"text": "猫もいます", "audioIndex": None}]
    assert "needs_audio" in {f.code for f in cand.flags}   # info flag: clips are generated or uploaded after adding


# --- consigne, support text, suspicious types -------------------------------------------------

def test_split_prompt_puts_word_banks_in_support_text(model):
    model.replies = [[]]
    el.extract_exercises(CHUNK, API, "English", None)
    system = model.calls[0][0]
    assert "word bank" in system and "support_text" in system and "select_in_the_blank" in system


def test_build_prompt_asks_for_the_consigne():
    assert '"consigne"' in el._build_prompt("quizz", "English")


def test_each_item_carries_the_block_instruction_as_consigne(model):
    model.replies = [[_block("quizz", ["Pick"]), _block("answering", ["Q1"], keys=["A1"])], QUIZ]
    out = el.extract_exercises(CHUNK, API, "English", None)
    assert [o["consigne"] for o in out] == ["Do it", "Do it"]
    assert out[0]["question"] == "Pick"          # the item itself stays bare; verify joins them


def _ex(etype, question, consigne="Fill in", content=None, answer="a", page="Fill in x a b"):
    raw = {"exercise_type": etype, "question": question, "answer": answer, "content": content, "quote": question,
           "consigne": consigne, "text_support": None}
    return el.verify_element("exercise", raw, Chunk(id="p0c0", page=0, text=page, trust="native"), "en")


def test_consigne_leads_the_question_of_an_answering_exercise():
    assert _ex("answering", "What is x?").fields["question"] == "Fill in\nWhat is x?"


def test_consigne_survives_the_blank_rebuild():
    content = {"segments": ["x ", " b"], "blanks": [{"answer": "a"}]}
    assert _ex("type_in_the_blank", "x __ b", content=content).fields["question"] == "Fill in\nx __ b"


def test_matching_question_becomes_the_consigne_and_no_consigne_means_no_prefix():
    pairs = {"pairs": [["a", "b"]]}
    assert _ex("matching", "Match", content=pairs).fields["question"] == "Fill in"
    assert _ex("answering", "What is x?", consigne=None).fields["question"] == "What is x?"


def test_consigne_does_not_break_the_question_in_source_check():
    assert "quote_not_in_source" not in {f.code for f in _ex("answering", "Fill in x").flags}


@pytest.mark.parametrize("etype,question,suspect", [
    ("answering", "I ___ to school every day.", True),
    ("translate", "Il ……… un chat.", True),
    ("answering", "What is your name?", False),
    ("type_in_the_blank", "He (is / are) tall __.", True),
    ("type_in_the_blank", "He __ tall.", False),
])
def test_type_suspect_flag(etype, question, suspect):
    content = {"segments": ["a", "b"], "blanks": [{"answer": "x"}]} if etype == "type_in_the_blank" else None
    codes = {f.code for f in _ex(etype, question, content=content, page=f"Fill in {question} a").flags}
    assert ("type_suspect" in codes) is suspect
