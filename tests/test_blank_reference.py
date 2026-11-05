from types import SimpleNamespace

from lapp.services.evaluator import EvaluatorService


def _ex(kind, answer, content=None):
    return SimpleNamespace(exercise_type=kind, answer=answer, content=content)


def test_type_in_the_blank_is_compared_with_its_blanks_only():
    content = {"segments": ["我喝", "，", "。"], "blanks": [{"answer": "水"}, {"answer": "茶"}]}
    assert EvaluatorService._reference_answer(_ex("type_in_the_blank", "我喝水，茶。", content)) == "水, 茶"


def test_other_exercises_keep_their_answer():
    assert EvaluatorService._reference_answer(_ex("translate", "I drink water.")) == "I drink water."
    assert EvaluatorService._reference_answer(_ex("type_in_the_blank", "x", None)) == "x"
