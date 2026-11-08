import json
from pathlib import Path
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


_FIXTURES = json.loads((Path(__file__).parents[1] / "client/src/test/exerciseContent.json").read_text())   # shared with the client runner test
GOOD, BAD = _FIXTURES["good"], _FIXTURES["bad"]


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


def test_a_reading_built_by_the_app_is_ready():
    from lapp.services.ingestion.elements import reading_content
    stored = reading_content({"speakers": [{"name": "A"}, {"name": "B"}], "lines": [{"speaker": "A", "text": "hi"}, {"speaker": "B", "text": "yo"}]})
    assert _needs("reading", stored) == []
    assert _needs("reading", {**stored, "lines": [{**stored["lines"][0], "speakerId": "zz"}]}) == ["content"]
