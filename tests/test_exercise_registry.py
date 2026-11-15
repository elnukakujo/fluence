"""The exercise-type registry is the single source for type names, time, scales and thresholds."""
import subprocess
import sys

import pytest

from lapp.services.exercises.registry import (
    EXERCISE_TIME, EXERCISE_TIME_DEFAULT, EXERCISE_TYPES, exercise_type,
)

TODAY = ("essay", "answering", "translate", "speaking", "conversation", "organize", "type_in_the_blank",
         "select_in_the_blank", "matching", "true_false", "quizz", "reading", "dictation")


def test_exercise_types_order():
    assert EXERCISE_TYPES == TODAY


def test_every_type_has_a_time_and_unknown_falls_back_to_default():
    for t in TODAY:
        assert t in EXERCISE_TIME
    assert exercise_type("nope") is None


def test_free_text_and_whole_block_membership():
    from lapp.services.exercises.registry import FREE_TEXT, WHOLE_BLOCK
    assert FREE_TEXT == frozenset({"essay", "answering", "translate", "speaking"})
    assert set(WHOLE_BLOCK) == {"reading", "dictation"}


def test_evaluator_scales_identical_to_today():
    from lapp.services.evaluator import EvaluatorService
    assert EvaluatorService.exercises_scales == {
        "translate": (0.6, 0.2, 0.2),
        "organize": (0.5, 0.1, 0.4),
        "type_in_the_blank": (0.5, 0.1, 0.4),
        "essay": (0.4, 0.4, 0.2),
        "answering": (0.6, 0.3, 0.1),
        "speaking": (0.3, 0.1, 0.6),
        "conversation": (0.3, 0.1, 0.6),
        "dictation": (0.0, 0.0, 1.0),
    }


def test_level_thresholds_present_for_the_seven_level_types():
    leveled = {"speaking", "type_in_the_blank", "organize", "translate", "answering", "conversation", "essay"}
    for t in TODAY:
        thresholds = exercise_type(t).thresholds
        if t in leveled:
            assert thresholds is not None and len(thresholds) == 5
        else:
            assert thresholds is None


def test_models_exercise_does_not_import_ingestion():
    code = "import lapp.models.features.exercise; import sys; print('lapp.services.ingestion' in sys.modules)"
    out = subprocess.check_output([sys.executable, "-c", code]).decode().strip()
    assert out == "False"


def test_schema_rejects_unknown_type():
    from lapp.schemas.features.exercise import ExerciseDict
    with pytest.raises(ValueError):
        ExerciseDict(exercise_type="not_a_real_type", question="q")
