import pytest

from lapp.services.ingestion import elements as el, exercises as ex
from lapp.services.ingestion.extract import ExtractionError
from lapp.services.ingestion.types import Chunk

API = {"base_url": "https://x/v1", "api_key": "k", "model": "m"}
CHUNK = Chunk(id="p0c0", page=0, text="Fill in the gaps. He __ tall. She __ short. is are", trust="native")
BLANK = {"question": "He __ tall.", "consigne": "Fill in the gaps.", "answer": "is", "quote": "He __ tall.",
         "content": {"segments": ["He ", " tall."], "blanks": [{"answer": "is"}]}}
CARD = {"exercise_type": "answering", "question": "Fill in the gaps.\nHe __ tall.", "answer": "is", "text_support": "is are"}


@pytest.fixture
def model(monkeypatch):
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


def test_regenerate_with_a_chosen_type_builds_once_and_keeps_support_and_consigne(model):
    model.replies = [BLANK]
    out = ex.regenerate_exercise(CARD, CHUNK, API, "English", exercise_type="type_in_the_blank")
    assert len(model.calls) == 1
    assert out["exercise_type"] == "type_in_the_blank" and out["question"] == "Fill in the gaps.\nHe __ tall."
    assert out["text_support"] == "is are" and out["content"]["blanks"] == [{"answer": "is"}]
    assert "type_suspect" not in {f["code"] for f in out["flags"]}


def test_regenerate_without_a_type_asks_the_model_to_choose_and_sends_the_request(model):
    model.replies = [{"type": "type_in_the_blank"}, BLANK]
    out = ex.regenerate_exercise(CARD, CHUNK, API, "English", request="the gaps need a word bank")
    assert out["exercise_type"] == "type_in_the_blank" and len(model.calls) == 2
    assert all("the gaps need a word bank" in user for _, user in model.calls)
    assert "Page text" in model.calls[1][1] and "He __ tall." in model.calls[1][1]


def test_an_unusable_choice_keeps_the_current_type(model):
    model.replies = [{"type": "poem"}, {"question": "Q", "consigne": None, "answer": "A", "content": None, "quote": "Q"}]
    assert ex.regenerate_exercise(CARD, CHUNK, API, "English")["exercise_type"] == "answering"


def test_unknown_requested_type_is_a_value_error(model):
    with pytest.raises(ValueError):
        ex.regenerate_exercise(CARD, CHUNK, API, "English", exercise_type="poem")


def test_merge_sends_every_question_and_support_once_and_builds_one_exercise(model):
    model.replies = [BLANK]
    items = [{**CARD}, {"exercise_type": "answering", "question": "Fill in the gaps.\nShe __ short.", "answer": "is", "text_support": "is are"}]
    out = ex.merge_exercises(items, CHUNK, API, "English", exercise_type="type_in_the_blank")
    user = model.calls[0][1].split("Page text")[0]
    assert "He __ tall." in user and "She __ short." in user and user.count("is are") == 1
    assert out["exercise_type"] == "type_in_the_blank" and out["text_support"] == "is are"


def test_merge_joins_the_support_of_cards_that_differ(model):
    model.replies = [{"question": "Q", "consigne": None, "answer": "A", "content": None, "quote": "Q"}]
    items = [{**CARD, "text_support": "one"}, {**CARD, "text_support": "two"}]
    assert ex.merge_exercises(items, CHUNK, API, "English", exercise_type="answering")["text_support"] == "one\n\ntwo"


def test_invalid_content_is_retried_once_then_kept_flagged(model):
    model.replies = [{**BLANK, "content": {"nope": 1}}, {**BLANK, "content": {"nope": 2}}]
    out = ex.regenerate_exercise(CARD, CHUNK, API, "English", exercise_type="type_in_the_blank")
    assert len(model.calls) == 2 and "content_invalid" in {f["code"] for f in out["flags"]}


def test_model_error_passes_through(model):
    model.replies = [ExtractionError("down")]
    with pytest.raises(ExtractionError):
        ex.regenerate_exercise(CARD, CHUNK, API, "English", exercise_type="essay")


def test_merge_needs_two_items(model):
    with pytest.raises(ValueError):
        ex.merge_exercises([CARD], CHUNK, API, "English")


def test_combined_chunk_joins_the_named_chunks_in_order_and_ignores_unknown_ids():
    a, b = Chunk(id="p0c0", page=0, text="A", trust="native"), Chunk(id="p1c0", page=1, text="B", trust="native")
    out = ex.combined_chunk([a, b], ["p1c0", "p0c0", "p1c0", "nope"])
    assert out.id == "p1c0" and out.text == "B\nA"
    assert ex.combined_chunk([a, b], ["nope"]) is None
