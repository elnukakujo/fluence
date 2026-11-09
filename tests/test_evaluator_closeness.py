"""The lexical signal of reference-answer types is raised by character closeness, never lowered."""
from types import SimpleNamespace

import numpy as np
import pytest

from lapp.services import evaluator as evaluator_module
from lapp.services.evaluator import EvaluatorService


class FakeModel:
    def encode(self, text): return np.array([1.0, 0.0])


def _svc(monkeypatch, exercise_type, correct, token):
    monkeypatch.setattr(EvaluatorService, "text_embedding_model", property(lambda self: FakeModel()))
    monkeypatch.setattr(evaluator_module.exercise_service, "get_by_id", lambda *a, **k: SimpleNamespace(exercise_type=exercise_type, answer=correct))
    s = EvaluatorService()
    monkeypatch.setattr(s, "_get_correct_text_and_type", lambda *a, **k: (correct, exercise_type))
    monkeypatch.setattr(s, "_compute_grammar_error_rate", lambda *a, **k: 1.0)
    monkeypatch.setattr(s, "_compute_token_differences_rate", lambda *a, **k: token)
    return s


def test_dictation_one_wrong_character_beats_token_only(monkeypatch):
    r = _svc(monkeypatch, "dictation", "bonjour", 0.0)._evaluate_text("ex_1", "bonjoux")
    assert r["token_difference_rate"] == pytest.approx(1 - 1 / 7) and r["score"] == pytest.approx(1 - 1 / 7)


@pytest.mark.parametrize("kind", ["translate", "type_in_the_blank", "organize"])
def test_reference_types_never_lower(monkeypatch, kind):
    r = _svc(monkeypatch, kind, "the cat sleeps", 0.9)._evaluate_text("ex_1", "xyz")
    assert r["token_difference_rate"] == 0.9


@pytest.mark.parametrize("kind", ["answering", "essay"])
def test_free_form_types_do_not_use_closeness(monkeypatch, kind):
    r = _svc(monkeypatch, kind, "bonjour", 0.0)._evaluate_text("ex_1", "bonjoux")
    assert r["token_difference_rate"] == 0.0
