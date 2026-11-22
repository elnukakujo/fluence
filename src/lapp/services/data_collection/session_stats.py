"""What one review session came to (ST-9): cards done, correct, time, average score gained, average difficulty change, per type.

A card is counted once: an exercise writes one progress row per linked element plus its own (all sharing `card_id`), any other card is one row.
Duration is the sum of the cards' own durations (never wall clock); an exercise card's gain and difficulty change are the mean over its
linked elements, its "correct" is its own row."""
from statistics import mean
from typing import Optional

from sqlalchemy.orm import Session

from ...core.database import transactional
from ...models.data_collection.progress_tracking import ProgressTracking

EMPTY = {"cards": 0, "correct": 0, "duration_ms": 0, "avg_score_gain": 0.0, "avg_difficulty_change": 0.0, "by_type": {}}


def _card(rows: list[ProgressTracking]) -> dict:
    own = [r for r in rows if r.element_type == "exercise"]
    parts = [r for r in rows if r.element_type != "exercise"] or own
    diffs = [r.difficulty_after - r.difficulty_before for r in parts if r.difficulty_before is not None and r.difficulty_after is not None]
    return {"type": "exercise" if own else rows[0].element_type, "correct": all(r.result for r in (own or rows)),
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
            if (r.card_id or "").startswith("ex_"):
                by_exercise.setdefault(r.card_id, []).append(r)
            else:
                cards.append(_card([r]))
        cards += [_card(group) for group in by_exercise.values()]
        diffs = [c["difficulty"] for c in cards if c["difficulty"] is not None]
        by_type: dict[str, int] = {}
        for c in cards:
            by_type[c["type"]] = by_type.get(c["type"], 0) + 1
        return {"cards": len(cards), "correct": sum(c["correct"] for c in cards), "duration_ms": round(sum(c["duration_ms"] for c in cards)),
                "avg_score_gain": round(mean(c["gain"] for c in cards), 1), "avg_difficulty_change": round(mean(diffs), 3) if diffs else 0.0, "by_type": by_type}
