from types import SimpleNamespace

import pytest

from lapp.schemas.features.exercise import ExerciseDict
from lapp.services import evaluator as evaluator_module
from lapp.services.evaluator import EvaluatorService

READING = {"speakers": [{"id": "s1", "name": "Li"}],
           "lines": [{"speakerId": "s1", "text": "你好", "translation": None, "audioIndex": None}]}


def test_reading_accepts_one_speaker():
    ExerciseDict(exercise_type="reading", question="Read", answer="你好", content=READING)


def test_reading_requires_speakers_and_lines():
    with pytest.raises(ValueError, match="speakers"):
        ExerciseDict(exercise_type="reading", question="Read", answer="你好", content={"lines": []})


def test_dictation_requires_lines():
    with pytest.raises(ValueError):
        ExerciseDict(exercise_type="dictation", question="Write", answer="a", content=None)
    ExerciseDict(exercise_type="dictation", question="Write", answer="a", content={"lines": [{"text": "a", "audioIndex": None}]})


def test_dictation_is_scored_by_token_overlap_only():
    assert EvaluatorService.exercises_scales["dictation"] == (0.0, 0.0, 1.0)
    assert "dictation" in EvaluatorService.exercises_thresholds


def test_dictation_text_is_gettable(monkeypatch):
    monkeypatch.setattr(evaluator_module.exercise_service, "get_by_id",
                        lambda *a, **k: SimpleNamespace(exercise_type="dictation", answer="abc"))
    assert EvaluatorService()._get_correct_text_and_type("ex_1") == ("abc", "dictation")
