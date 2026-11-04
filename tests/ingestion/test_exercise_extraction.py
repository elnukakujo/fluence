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
