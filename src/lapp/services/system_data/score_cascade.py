"""One aggregate for every parent score (lesson, language, word, passage, character).

A child contributes the mean of its *enabled, answered* skills; a child with none counts 0 in the parent's score
and is left out of `mean_seen`. Parents only ever change through their children (SC-11/12)."""
from dataclasses import dataclass
from statistics import mean
from typing import Iterable, Optional

from sqlalchemy.orm import Session

from ...models.system_data import Score
from .score import ScoreService

DEFAULT_DIFFICULTY = 0.5


@dataclass(frozen=True)
class ChildScore:
    skills: dict                    # skill -> effective score, only skills that have a row (answered)
    difficulty: float = DEFAULT_DIFFICULTY


@dataclass(frozen=True)
class Aggregate:
    score: float                    # mean over all children, unanswered ones count 0
    coverage: float                 # share of children answered in an enabled skill
    mean_seen: float                # mean over answered children only
    difficulty: float


def aggregate(children: list[ChildScore], enabled_skills: Optional[Iterable[str]] = None) -> Aggregate:
    """`enabled_skills=None` = every skill. An enabled skill nobody answered is ignored, never read as 0."""
    enabled = None if enabled_skills is None else set(enabled_skills)
    seen = []
    for c in children:
        vals = [v for k, v in c.skills.items() if enabled is None or k in enabled]
        if vals:
            seen.append(mean(vals))
    if not children:
        return Aggregate(0.0, 0.0, 0.0, DEFAULT_DIFFICULTY)
    return Aggregate(
        score=sum(seen) / len(children),
        coverage=len(seen) / len(children),
        mean_seen=mean(seen) if seen else 0.0,
        difficulty=mean(c.difficulty for c in children))


def refresh(user_id: str, parent_id: str, child_ids: list[str], *, digits: Optional[int] = None, touch: bool = True,
            current_lesson_id: Optional[str] = None, enabled_skills: Optional[Iterable[str]] = None,
            session: Session) -> Score:
    """Recompute and store the parent's aggregate row from its children.
    ponytail: `enabled_skills` is not wired to a user setting yet (no such setting exists), so it defaults to all skills."""
    service = ScoreService()
    skills = service.skill_scores(user_id, child_ids, session=session)
    diffs = service.get_many(user_id, child_ids, session=session)
    agg = aggregate([ChildScore(skills.get(i, {}), diffs[i].difficulty if i in diffs else DEFAULT_DIFFICULTY)
                     for i in child_ids], enabled_skills)
    score = round(agg.score, digits) if digits is not None else agg.score
    return service.set(user_id, parent_id, score, agg.difficulty, current_lesson_id=current_lesson_id,
                       touch=touch, session=session)
