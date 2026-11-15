"""The shared study-constants JSON is the single source: server and client read the same numbers."""
import json
from pathlib import Path

from lapp.services.features.study_constants import GOAL_MASTERED_SCORE

SHARED = Path(__file__).resolve().parent.parent / "shared" / "study-constants.json"


def _load():
    return json.loads(SHARED.read_text(encoding="utf-8"))


def _strip_todo(d):
    if isinstance(d, dict):
        return {k: _strip_todo(v) for k, v in d.items() if k != "_todo"}
    return d


def test_goal_mastered_score_reads_the_shared_file():
    assert GOAL_MASTERED_SCORE == _load()["goalMasteredScore"]


def test_shared_json_matches_the_literal_table():
    assert _strip_todo(_load()) == {
        "tier": {"learningScore": 20, "learningDifficulty": 0.7, "maintainingScore": 60},
        "hints": {"caps": [1, 0.75, 0.5], "fastMs": 3000, "slowMs": 10000},
        "typed": {"full": 0.9, "floor": 0.4},
        "cadence": {"drawEvery": 3, "listenEvery": 3},
        "goalMasteredScore": 60.0,
    }


def test_every_group_carries_its_todo():
    data = _load()
    for group in ("tier", "hints", "typed", "cadence"):
        assert isinstance(data[group]["_todo"], str) and "TODO" in data[group]["_todo"]
