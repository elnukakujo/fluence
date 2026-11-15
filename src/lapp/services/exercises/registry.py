"""The one place that lists the exercise types and their metadata (time, evaluator scale, level thresholds).

Replaces the scattered `EXERCISE_TYPES` / `EXERCISE_TIME` / `FREE_TEXT` / `WHOLE_BLOCK` / scale
definitions. Scale and level thresholds read the shared constants file; time is the current
`EXERCISE_TIME` numbers.
"""
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

_SHARED = json.loads((Path(__file__).resolve().parents[4] / "shared" / "study-constants.json").read_text(encoding="utf-8"))
_SCALES = {k: tuple(v) for k, v in _SHARED["exerciseScales"].items()}
_LEVELS = {k: tuple(v) for k, v in _SHARED["exerciseLevelThresholds"].items()}


@dataclass(frozen=True)
class ExerciseType:
    name: str                          # "true_false"
    time: dict                         # {"base","per_item","typed"}
    scale: Optional[tuple]             # evaluator weights; None for closed types
    thresholds: Optional[tuple]        # level thresholds from the shared constants; None where there are no levels
    free_text: bool                    # no content: only question / answer
    whole_block: bool                  # one candidate per block (a passage is not split per line)
    skills: tuple = ()                 # slot for the target domain, unread today


_TYPES = (
    ExerciseType("essay", {"base": 45.0, "per_item": 0.0, "typed": True}, _SCALES["essay"], _LEVELS.get("essay"), True, False),
    ExerciseType("answering", {"base": 6.0, "per_item": 0.0, "typed": True}, _SCALES["answering"], _LEVELS.get("answering"), True, False),
    ExerciseType("translate", {"base": 5.0, "per_item": 0.0, "typed": True}, _SCALES["translate"], _LEVELS.get("translate"), True, False),
    ExerciseType("speaking", {"base": 15.0, "per_item": 0.0, "typed": False}, _SCALES["speaking"], _LEVELS.get("speaking"), True, False),
    ExerciseType("conversation", {"base": 15.0, "per_item": 5.0, "typed": False}, _SCALES["conversation"], _LEVELS.get("conversation"), False, False),
    ExerciseType("organize", {"base": 6.0, "per_item": 1.5, "typed": False}, _SCALES["organize"], _LEVELS.get("organize"), False, False),
    ExerciseType("type_in_the_blank", {"base": 6.0, "per_item": 2.0, "typed": True}, _SCALES["type_in_the_blank"], _LEVELS.get("type_in_the_blank"), False, False),
    ExerciseType("select_in_the_blank", {"base": 5.0, "per_item": 1.5, "typed": False}, None, None, False, False),
    ExerciseType("matching", {"base": 6.0, "per_item": 2.0, "typed": False}, None, None, False, False),
    ExerciseType("true_false", {"base": 4.0, "per_item": 0.0, "typed": False}, None, None, False, False),
    ExerciseType("quizz", {"base": 5.0, "per_item": 1.5, "typed": False}, None, None, False, False),
    ExerciseType("reading", {"base": 15.0, "per_item": 0.0, "typed": False}, None, None, False, True),
    ExerciseType("dictation", {"base": 10.0, "per_item": 0.0, "typed": True}, _SCALES["dictation"], None, False, True),
)

EXERCISE_TYPES = tuple(t.name for t in _TYPES)
FREE_TEXT = frozenset(t.name for t in _TYPES if t.free_text)
WHOLE_BLOCK = tuple(t.name for t in _TYPES if t.whole_block)
EXERCISE_TIME = {t.name: t.time for t in _TYPES}
EXERCISE_TIME_DEFAULT = {"base": 10.0, "per_item": 1.0, "typed": False}   # an unknown exercise type

_TYPE_BY_NAME = {t.name: t for t in _TYPES}


def exercise_type(name: str) -> Optional[ExerciseType]:
    return _TYPE_BY_NAME.get(name)
