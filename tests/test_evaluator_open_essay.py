"""An essay without a reference answer is scored locally: grammar (LanguageTool), relevance to the prompt (embeddings), use of the linked words."""
import numpy as np
import pytest

from lapp.services.evaluator import EvaluatorService


class FakeModel:
    def encode(self, text):
        return np.array([1.0, 0.0]) if "day" in text else np.array([0.0, 1.0])


@pytest.fixture
def svc(monkeypatch):
    monkeypatch.setattr(EvaluatorService, "text_embedding_model", property(lambda self: FakeModel()))
    s = EvaluatorService()
    monkeypatch.setattr(s, "_compute_grammar_error_rate", lambda *a, **k: 1.0)
    return s


def test_on_topic_text_using_every_word_scores_full(svc):
    r = svc._open_ended_scores("my day was good", "Write about your day", ["day", "good"], "eng")
    assert r["similarity"] == pytest.approx(1.0) and r["token_difference_rate"] == 1.0 and r["score"] == pytest.approx(1.0)


def test_no_linked_words_does_not_divide_by_zero(svc):
    assert svc._open_ended_scores("my day", "Write about your day", [], "eng")["token_difference_rate"] == 1.0


def test_off_topic_text_scores_lower(svc):
    on = svc._open_ended_scores("my day", "Write about your day", [], "eng")["score"]
    off = svc._open_ended_scores("bananas", "Write about your day", [], "eng")["score"]
    assert off < on


def test_grammar_errors_and_unused_words_lower_the_score(svc, monkeypatch):
    full = svc._open_ended_scores("my day", "Write about your day", ["day"], "eng")["score"]
    monkeypatch.setattr(svc, "_compute_grammar_error_rate", lambda *a, **k: 0.3)
    assert svc._open_ended_scores("my day", "Write about your day", ["day"], "eng")["score"] < full
    assert svc._open_ended_scores("my day", "Write about your day", ["cat"], "eng")["token_difference_rate"] == 0.0
