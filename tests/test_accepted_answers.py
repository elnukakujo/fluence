"""Accepted answers: a typed answer is scored against `answer` and every accepted answer; the best one counts."""
from types import SimpleNamespace
from unittest.mock import patch

from lapp.services.evaluator import EvaluatorService


def test_best_of_accepted_answers():
    ex = SimpleNamespace(exercise_type="translate", answer="I am fine", content=None, accepted_answers=["I'm fine", "", "I am fine"])
    ev = object.__new__(EvaluatorService)       # the scoring body is stubbed: no model to load
    seen = []
    def fake(ex_id, user, ref, kind, iso):
        seen.append(ref)
        return {"score": 1.0 if ref == "I'm fine" else 0.2, "correct_answer": ref}
    with patch("lapp.services.evaluator.exercise_service.get_by_id", return_value=ex), patch.object(ev, "_score_against", side_effect=fake):
        out = ev._evaluate_text("ex_1", "I'm fine", "eng")
    assert seen == ["I am fine", "I'm fine"]            # the display answer first, blanks and duplicates dropped
    assert out["score"] == 1.0 and out["correct_answer"] == "I'm fine"
