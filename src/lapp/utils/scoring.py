"""Pure scoring engine (spec 2): decay on read, stability, evidence weights, day cap, levels, leech.

No I/O, no database: every formula of the score model lives here so it can be unit-tested.
Numbers come from the owner's decisions (see docs/superpowers/specs/2026-11-14-scoring-and-data-model-design.md);
Task 1 moves them into shared/study-constants.json.

STEP = 7.5 is the audit's day-one number (simulation S1: one perfect answer on a fresh item = +7.5 today),
so a perfect typed answer moves a new item by the same order as before.
"""
from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import date, datetime, tzinfo
from typing import Literal

INITIAL_STABILITY_DAYS = 2.0
STABILITY_CAP_DAYS = 180.0
DAY_GAIN_CAP = 15.0
STEP = 7.5
WEAK_BELOW = 40
KNOWN_FROM = 60
MASTERED_FROM = 85
LEECH_WRONG, LEECH_WINDOW, LEECH_LEAVE_IN_ROW = 4, 8, 3
# TODO(owner): quality at/above which an answer counts as correct (stability x2, leech streak). 0.5 = "hard" is a pass that earns nothing.
CORRECT_AT = 0.5
# TODO(owner): smallest stability after repeated wrong answers (÷2 each time); never reaches 0.
MIN_STABILITY_DAYS = 0.5

EVIDENCE_WEIGHTS = {"typed": 1.0, "spoken": 1.0, "self_grade": 0.8, "multiple_choice": 0.6, "matching": 0.6}

Level = Literal["learning", "known", "mastered"]


@dataclass(frozen=True)
class ScoreState:
    score: float                       # as of last_seen_at (never pre-decayed)
    stability: float                   # days for the score to halve
    last_seen_at: datetime | None
    recent: str = ""                   # up to 8 chars "0"/"1", newest last
    is_leech: bool = False
    day_date: date | None = None       # learner-local day of day_gain
    day_gain: float = 0.0


def effective_score(score: float, stability: float, last_seen_at: datetime | None, now: datetime) -> float:
    """Score as of `now`: halves every `stability` days. No decay if never seen or last_seen is in the future."""
    if last_seen_at is None or last_seen_at >= now:
        return score
    days = (now - last_seen_at).total_seconds() / 86400
    return score * 0.5 ** (days / stability)


def level_for(score: float) -> Level:
    return "mastered" if score >= MASTERED_FROM else "known" if score >= KNOWN_FROM else "learning"


def is_weak(score: float) -> bool:
    return score < WEAK_BELOW


def _local_day(now: datetime, tz: tzinfo | None) -> date:
    return (now.astimezone(tz) if tz and now.tzinfo else now).date()


def apply_answer(state: ScoreState, quality: float, evidence_weight: float, now: datetime,
                 tz: tzinfo | None = None) -> ScoreState:
    """decay -> weighted symmetric delta -> same-day gain cap -> stability -> recent/leech."""
    quality = min(max(quality, 0.0), 1.0)
    score = effective_score(state.score, state.stability, state.last_seen_at, now)

    today = _local_day(now, tz)
    day_gain = state.day_gain if state.day_date == today else 0.0
    delta = (quality - 0.5) * 2 * evidence_weight * STEP
    if delta > 0:                                     # cap applies to gains only; losses are uncapped
        delta = min(delta, max(0.0, DAY_GAIN_CAP - day_gain))
        day_gain += delta
    score = min(max(score + delta, 0.0), 100.0)

    correct = quality >= CORRECT_AT
    stability = state.stability * 2 if correct else state.stability / 2
    stability = min(max(stability, MIN_STABILITY_DAYS), STABILITY_CAP_DAYS)

    recent = (state.recent + ("1" if correct else "0"))[-LEECH_WINDOW:]
    is_leech = state.is_leech
    if not is_leech and recent.count("0") >= LEECH_WRONG:
        is_leech = True
    elif is_leech and recent.endswith("1" * LEECH_LEAVE_IN_ROW):
        is_leech = False

    return replace(state, score=score, stability=stability, last_seen_at=now, recent=recent,
                   is_leech=is_leech, day_date=today, day_gain=day_gain)
