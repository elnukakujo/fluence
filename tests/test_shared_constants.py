"""The shared study-constants JSON is the single source: server and client read the same numbers."""
import json
from pathlib import Path

from lapp.utils import scoring

SHARED = Path(__file__).resolve().parent.parent / "shared" / "study-constants.json"


def _load():
    return json.loads(SHARED.read_text(encoding="utf-8"))


def _strip_todo(d):
    if isinstance(d, dict):
        return {k: _strip_todo(v) for k, v in d.items() if k != "_todo"}
    return d


def test_engine_reads_the_shared_numbers():
    d = _load()
    assert scoring.INITIAL_STABILITY_DAYS == d["score"]["initialStabilityDays"]
    assert scoring.STABILITY_CAP_DAYS == d["score"]["stabilityCapDays"]
    assert scoring.DAY_GAIN_CAP == d["score"]["dayGainCap"]
    assert scoring.EVIDENCE_WEIGHTS == d["score"]["evidenceWeights"]
    assert (scoring.WEAK_BELOW, scoring.KNOWN_FROM, scoring.MASTERED_FROM) == (
        d["levels"]["weakBelow"], d["levels"]["knownFrom"], d["levels"]["masteredFrom"])
    assert (scoring.LEECH_WRONG, scoring.LEECH_WINDOW, scoring.LEECH_LEAVE_IN_ROW) == (
        d["leech"]["enter"]["wrong"], d["leech"]["enter"]["window"], d["leech"]["leaveCorrectInRow"])


def test_goal_item_is_finished_at_the_known_level():
    from lapp.services.features import study_goal
    assert study_goal.KNOWN_FROM == _load()["levels"]["knownFrom"]


def test_shared_json_matches_the_literal_table():
    assert _strip_todo(_load()) == {
        "score": {"initialStabilityDays": 2, "stabilityCapDays": 180, "dayGainCap": 15,
                  "evidenceWeights": {"typed": 1.0, "spoken": 1.0, "self_grade": 0.8, "multiple_choice": 0.6, "matching": 0.6}},
        "levels": {"weakBelow": 40, "knownFrom": 60, "masteredFrom": 85},
        "leech": {"enter": {"wrong": 4, "window": 8}, "leaveCorrectInRow": 3},
        "tier": {"learningDifficulty": 0.7},
        "hints": {"caps": [1, 0.75, 0.5], "fastMs": 3000, "slowMs": 10000},
        "typed": {"full": 0.9, "floor": 0.4},
        "cadence": {"drawEvery": 3, "listenEvery": 3},
        "exerciseLevelThresholds": {
            "speaking": [0, 0.50, 0.70, 0.85, 0.95],
            "type_in_the_blank": [0, 0.50, 0.70, 0.85, 0.95],
            "organize": [0, 0.45, 0.65, 0.80, 0.92],
            "translate": [0, 0.40, 0.60, 0.78, 0.90],
            "answering": [0, 0.35, 0.55, 0.72, 0.88],
            "conversation": [0, 0.30, 0.50, 0.68, 0.85],
            "essay": [0, 0.25, 0.45, 0.65, 0.82],
        },
        "exerciseScales": {
            "translate": [0.6, 0.2, 0.2],
            "organize": [0.5, 0.1, 0.4],
            "type_in_the_blank": [0.5, 0.1, 0.4],
            "essay": [0.4, 0.4, 0.2],
            "answering": [0.6, 0.3, 0.1],
            "speaking": [0.3, 0.1, 0.6],
            "conversation": [0.3, 0.1, 0.6],
            "dictation": [0.0, 0.0, 1.0],
        },
    }


def test_evaluator_scales_equal_the_shared_file():
    from lapp.services.evaluator import EvaluatorService
    data = _load()
    assert EvaluatorService.exercises_scales == {k: tuple(v) for k, v in data["exerciseScales"].items()}


def test_every_group_carries_its_todo():
    data = _load()
    for group in ("tier", "hints", "typed", "cadence"):
        assert isinstance(data[group]["_todo"], str) and "TODO" in data[group]["_todo"]
