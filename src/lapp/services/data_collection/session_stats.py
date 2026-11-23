"""What one review session came to (ST-9): cards done, correct, time, average score gained, average difficulty change, per type.

A card is counted once: an exercise writes one progress row per linked element plus its own (all sharing `card_id`), any other card is one row.
Duration is the sum of the cards' own durations (never wall clock); an exercise card's gain and difficulty change are the mean over its
linked elements, its "correct" is its own row."""
from collections import OrderedDict
from statistics import mean
from typing import Optional

from sqlalchemy.orm import Session

from ...core.database import transactional
from ...models.data_collection.progress_tracking import ProgressTracking
from ...utils.element_kinds import kind_of
from ...utils.scoring import level_for
from ..features.study_goal import StudyGoalService

EMPTY = {"cards": 0, "correct": 0, "duration_ms": 0, "avg_score_gain": 0.0, "avg_difficulty_change": 0.0, "by_type": {},
         "levels_crossed": [], "to_revisit": [], "hints_used": 0, "avg_seconds_per_card": 0.0, "goal_progress": None}
_ORDER = ["learning", "known", "mastered"]


def _base(element_id: str) -> str:
    return element_id.split("#")[0]


def _card(rows: list[ProgressTracking]) -> dict:
    own = [r for r in rows if r.element_type == "exercise"]
    parts = [r for r in rows if r.element_type != "exercise"] or own
    diffs = [r.difficulty_after - r.difficulty_before for r in parts if r.difficulty_before is not None and r.difficulty_after is not None]
    return {"id": _base(rows[0].card_id or rows[0].element_id), "hint": any(r.hint_used for r in rows), "parts": parts,
            "type": "exercise" if own else rows[0].element_type, "correct": all(r.result for r in (own or rows)),
            "gain": mean(r.score_after - r.score_before for r in parts), "difficulty": mean(diffs) if diffs else None,
            "duration_ms": max(r.duration_ms for r in rows)}


class SessionStats:
    @transactional
    def get(self, user_id: str, session_id: str, session: Optional[Session] = None) -> dict:
        rows = session.query(ProgressTracking).filter_by(user_id=user_id, session_id=session_id).order_by(ProgressTracking.created_at).all()
        if not rows:
            return {**EMPTY, "by_type": {}}
        by_exercise: dict[str, list[ProgressTracking]] = {}
        cards = []
        for r in rows:
            if getattr(kind_of(r.card_id), "name", None) == "Exercise":
                by_exercise.setdefault(r.card_id, []).append(r)
            else:
                cards.append(_card([r]))
        cards += [_card(group) for group in by_exercise.values()]
        diffs = [c["difficulty"] for c in cards if c["difficulty"] is not None]
        by_type: dict[str, int] = {}
        for c in cards:
            by_type[c["type"]] = by_type.get(c["type"], 0) + 1
        return {"cards": len(cards), "correct": sum(c["correct"] for c in cards), "duration_ms": round(sum(c["duration_ms"] for c in cards)),
                "avg_score_gain": round(mean(c["gain"] for c in cards), 1), "avg_difficulty_change": round(mean(diffs), 3) if diffs else 0.0, "by_type": by_type,
                "levels_crossed": self._levels(cards, session), "to_revisit": list(OrderedDict.fromkeys(c["id"] for c in cards if not c["correct"])),
                "hints_used": sum(c["hint"] for c in cards),
                "avg_seconds_per_card": round(sum(c["duration_ms"] for c in cards) / len(cards) / 1000, 1),
                "goal_progress": self._goal(user_id, rows[0].language_id, session)}

    @staticmethod
    def _levels(cards: list[dict], session: Session) -> list[dict]:
        """Elements that moved up a level during the session (a vocabulary's two sides are one element): first level seen -> last level reached."""
        span: dict[str, list[str]] = {}
        for c in cards:
            for r in c["parts"]:
                ends = span.setdefault(_base(r.element_id), [level_for(r.score_before), level_for(r.score_after)])
                ends[1] = level_for(r.score_after)
        return [{"id": i, "label": StudyGoalService._describe(i, session)[0], "from": a, "to": b}
                for i, (a, b) in span.items() if _ORDER.index(b) > _ORDER.index(a)]

    @staticmethod
    def _goal(user_id: str, language_id: str, session: Session) -> Optional[dict]:
        """How this week's objectives stand: {met, total, partial}; None without a goal or a menu."""
        progress = StudyGoalService().progress(user_id, language_id, session=session)
        if progress is None:
            return None
        rows = progress["types"].values()
        total = sum(t["picked"] + t["review_picked"] for t in rows)
        if not total:
            return None
        return {"met": sum(t["mastered"] + t["review_done"] for t in rows), "total": total, "partial": round(sum(t["partial"] + t["review_partial"] for t in rows), 1)}
