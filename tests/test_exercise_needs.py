import json
from types import SimpleNamespace

import pytest

from lapp.models.features.exercise import Exercise


def _needs(t, content=None, files=None, question="q", answer="a", review_reason=None):
    # the property only reads a few attributes; a plain namespace avoids needing an app context
    return Exercise.needs.fget(SimpleNamespace(exercise_type=t, content=content, audio_files=files or [], review_reason=review_reason,
                                               question=question, answer=answer))


def test_dictation_needs_audio_until_every_line_has_a_clip():
    lines = [{"text": "a", "audioIndex": 0}, {"text": "b", "audioIndex": None}]
    assert _needs("dictation", {"lines": lines}, ["/m/a.wav"]) == ["audio"]
    lines[1]["audioIndex"] = 1
    assert _needs("dictation", {"lines": lines}, ["/m/a.wav"]) == ["audio"]   # index out of range
    assert _needs("dictation", {"lines": lines}, ["/m/a.wav", "/m/b.wav"]) == []


GOOD = [
    ("reading", {"speakers": [{"name": "A"}], "lines": [{"speaker": "A", "text": "a"}]}),
    ("essay", None), ("answering", None), ("translate", None), ("speaking", None),
    ("matching", {"pairs": [["a", "b"]]}),
    ("quizz", {"options": ["a", "b"], "correct": [0]}),
    ("true_false", {"statement": "s", "answer": True}),
    ("organize", {"items": ["a", "b"], "answer_order": [1, 0]}),
    ("type_in_the_blank", {"segments": ["a ", " b"], "blanks": [{"answer": "x"}]}),
    ("select_in_the_blank", {"segments": ["a ", " b"], "blanks": [{"answer": "x", "options": ["x", "y"]}]}),
]
BAD = [
    ("matching", {"pairs": []}), ("matching", {}), ("quizz", {}), ("quizz", {"options": ["a"], "correct": [0]}),
    ("true_false", {"statement": "s"}), ("organize", {"items": ["a"], "answer_order": []}),
    ("type_in_the_blank", {"segments": ["a"], "blanks": [{"answer": "x"}]}),
    ("select_in_the_blank", {"segments": ["a ", " b"], "blanks": [{"answer": "x"}]}),
    ("reading", {"lines": []}), ("matching", "oops"),
]


@pytest.mark.parametrize("t,content", GOOD)
def test_good_content_is_ready(t, content):
    assert _needs(t, content) == []


@pytest.mark.parametrize("t,content", BAD)
def test_bad_content_is_not_ready(t, content):
    assert _needs(t, content) == ["content"]


def test_conversation_reads_question_and_answer_not_content():
    data = {"speakers": [{"id": "1", "name": "A", "isUser": False}, {"id": "2", "name": "B", "isUser": True}],
            "lines": [{"speakerId": "1", "text": "hi"}, {"speakerId": "2", "text": "yo"}]}
    assert _needs("conversation", None, question=json.dumps(data), answer=json.dumps(data)) == []
    assert _needs("conversation", None, question="not json", answer="") == ["content"]


def test_review_and_content_are_both_reported():
    assert _needs("matching", {"pairs": []}, review_reason="doubt") == ["review", "content"]
