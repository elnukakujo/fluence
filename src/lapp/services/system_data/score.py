from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from ...core.database import db_manager, transactional
from ...models.system_data import Score
from ...utils.helpers import update_score, update_difficulty, status_for


SIDES = ("front", "back")


def side_id(voc_id: str, side: str) -> str:
    return f"{voc_id}#{side}"


class ScoreService:
    @transactional
    def record(self, user_id: str, element_id: str, similarity: float,
               session: Optional[Session] = None) -> Score:
        """Create/update a user's current score for an element (single write path)."""
        now = datetime.now()
        row = session.query(Score).filter(
            Score.user_id == user_id,
            Score.element_id == element_id,
        ).first()
        if row is None:
            row = Score(
                id=db_manager.generate_new_id(Score, session=session),
                user_id=user_id,
                element_id=element_id,
                score=0.0,
                difficulty=0.5,
                created_at=now,   # first engagement, set once
                last_seen_at=now,
            )
            session.add(row)
            session.flush()
            previous_last_seen = now
        else:
            previous_last_seen = row.last_seen_at or now

        row.score = update_score(
            score=row.score,
            last_seen_at=previous_last_seen,
            similarity=similarity,
            created_at=row.created_at,  # first engagement, not re-fabricated
            difficulty=row.difficulty,
        )
        row.difficulty = update_difficulty(
            new_score=row.score,
            last_seen_at=previous_last_seen,
            previous_difficulty=row.difficulty,
            created_at=row.created_at,
        )
        row.last_seen_at = now
        session.flush()
        return row

    @transactional
    def record_side(self, user_id: str, voc_id: str, side: str, similarity: float, step: int = 2,
                    session: Optional[Session] = None) -> Score:
        """Grade one side of a vocabulary. The side's step is doubled so the parent
        (the average of both sides) moves by one old single-card step. `step=1` is for
        callers grading both sides at once. Returns the parent row."""
        if side not in SIDES:
            raise ValueError(f"side must be one of {SIDES}, got {side!r}")
        sid = side_id(voc_id, side)
        before = self.get(user_id, sid, session=session)
        old_score = before.score if before else 0.0
        old_diff = before.difficulty if before else 0.5

        row = self.record(user_id, sid, similarity, session=session)
        row.score = round(min(max(old_score + step * (row.score - old_score), 0.0), 100.0), 4)
        row.difficulty = round(min(max(old_diff + step * (row.difficulty - old_diff), 0.0), 1.0), 4)

        sides = self.get_sides(user_id, voc_id, session=session)
        pairs = [(s.score, s.difficulty) if s else (0.0, 0.5) for s in sides.values()]
        parent = self.set(
            user_id, voc_id,
            score=round(sum(p[0] for p in pairs) / 2, 4),
            difficulty=round(sum(p[1] for p in pairs) / 2, 4),
            session=session,
        )
        return parent

    @transactional
    def get_sides(self, user_id: str, voc_id: str,
                  session: Optional[Session] = None) -> dict[str, Optional[Score]]:
        rows = self.get_many(user_id, [side_id(voc_id, s) for s in SIDES], session=session)
        return {s: rows.get(side_id(voc_id, s)) for s in SIDES}

    @transactional
    def get(self, user_id: str, element_id: str,
            session: Optional[Session] = None) -> Optional[Score]:
        return session.query(Score).filter(
            Score.user_id == user_id,
            Score.element_id == element_id,
        ).first()

    @transactional
    def get_many(self, user_id: str, element_ids: list[str],
                 session: Optional[Session] = None) -> dict[str, Score]:
        if not element_ids:
            return {}
        rows = session.query(Score).filter(
            Score.user_id == user_id,
            Score.element_id.in_(element_ids),
        ).all()
        return {r.element_id: r for r in rows}

    @transactional
    def set(self, user_id: str, element_id: str, score: float, difficulty: float,
            current_lesson_id: Optional[str] = None, touch: bool = True,
            session: Optional[Session] = None) -> Score:
        """Upsert a Score row with explicit values (for container/component aggregates).
        `touch=False` leaves `last_seen_at` alone (None on a new row): a recompute that is not a review, e.g. a lesson merge."""
        now = datetime.now()
        row = session.query(Score).filter(
            Score.user_id == user_id,
            Score.element_id == element_id,
        ).first()
        if row is None:
            row = Score(
                id=db_manager.generate_new_id(Score, session=session),
                user_id=user_id,
                element_id=element_id,
                score=score,
                difficulty=difficulty,
                created_at=now,
                last_seen_at=now if touch else None,
                current_lesson_id=current_lesson_id,
            )
            session.add(row)
        else:
            row.score = score
            row.difficulty = difficulty
            if touch:
                row.last_seen_at = now
            if current_lesson_id is not None:
                row.current_lesson_id = current_lesson_id
        session.flush()
        return row

    @transactional
    def delete_for(self, element_ids: list[str], session: Optional[Session] = None) -> None:
        """Drop every user's Score rows for these elements (vocabulary: also the #front/#back rows)."""
        ids = [*element_ids, *(side_id(i, s) for i in element_ids if i.startswith("voc_") for s in SIDES)]
        session.query(Score).filter(Score.element_id.in_(ids)).delete(synchronize_session=False)

    @transactional
    def merge(self, user_id: str, elements: list[dict],
              session: Optional[Session] = None) -> list[dict]:
        """Inject score/difficulty/status/last_seen_at into serialized element dicts."""
        ids = [e["id"] for e in elements if e.get("id")]
        side_ids = [side_id(i, s) for i in ids if i.startswith("voc_") for s in SIDES]
        rows = {r.element_id: r for r in session.query(Score).filter(
            Score.user_id == user_id, Score.element_id.in_(ids + side_ids)).all()}
        for e in elements:
            eid = e.get("id")
            r = rows.get(eid)
            if eid and eid.startswith("voc_"):
                for sd in SIDES:
                    sr = rows.get(side_id(eid, sd))
                    e[f"{sd}_score"] = sr.score if sr else 0.0
                    e[f"{sd}_difficulty"] = sr.difficulty if sr else 0.5
            if r is not None:
                e["score"] = r.score
                e["difficulty"] = r.difficulty
                e["status"] = status_for(eid, r.score)
                e["last_seen_at"] = r.last_seen_at
                e["current_lesson_id"] = r.current_lesson_id
            else:
                e["score"] = 0.0
                e["difficulty"] = 0.5
                e["status"] = status_for(eid, 0.0)
                e["last_seen_at"] = None
                e["current_lesson_id"] = None
        return elements
