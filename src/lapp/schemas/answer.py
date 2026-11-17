from typing import Literal, Optional

from pydantic import BaseModel, Field

from ..utils.element_kinds import kind_of


class AnswerPayload(BaseModel):
    """One graded answer, as every score route receives it. Out-of-range input is a 400, never clamped silently."""
    similarity: float = Field(ge=0, le=1)
    skill: Literal["recognition", "recall"]
    evidence_type: Literal["typed", "spoken", "self_grade", "multiple_choice", "matching"]
    duration_ms: int = Field(ge=0, le=600_000)
    hint_used: bool = False
    side: Optional[Literal["front", "back"]] = None
    attempt_number: Optional[int] = Field(default=None, ge=1)     # exercises only


def parse_answer(element_id: str, data: dict) -> AnswerPayload:
    """Validate a score body for an element; ValueError (pydantic's included) means HTTP 400."""
    payload = AnswerPayload.model_validate(data)
    kind = kind_of(element_id)
    if payload.skill not in ((kind.skills if kind else ()) or ("recall",)):     # exercises keep the one `recall` row
        raise ValueError(f"skill {payload.skill!r} is not valid for {kind.name if kind else element_id}")
    return payload


class ExerciseResult(BaseModel):
    """What one blank / pair / whole exercise says about one element."""
    element_id: str
    quality: float = Field(ge=0, le=1)
    skill: Literal["recognition", "recall"]
    evidence_type: Literal["typed", "spoken", "self_grade", "multiple_choice", "matching"]


class ExerciseAnswer(BaseModel):
    """An exercise attempt: the server credits only the `final` one (EX-D2)."""
    results: list[ExerciseResult] = Field(min_length=1)
    attempt: int = Field(ge=1)
    final: bool
    duration_ms: int = Field(ge=0, le=600_000)
    hint_used: bool = False


def parse_exercise_answer(data: dict) -> ExerciseAnswer:
    """Validate an exercise score body; ValueError (pydantic's included) means HTTP 400. Each result's skill must exist for its element's kind."""
    answer = ExerciseAnswer.model_validate(data)
    for r in answer.results:
        parse_answer(r.element_id, {"similarity": r.quality, "skill": r.skill, "evidence_type": r.evidence_type, "duration_ms": answer.duration_ms})
    return answer
