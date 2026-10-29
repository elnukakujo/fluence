from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from ...core.database import db_manager, transactional
from ...models.system_data import Score
from ...utils.helpers import update_score, update_difficulty


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
            current_lesson_id: Optional[str] = None,
            session: Optional[Session] = None) -> Score:
        """Upsert a Score row with explicit values (for container/component aggregates)."""
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
                last_seen_at=now,
                current_lesson_id=current_lesson_id,
            )
            session.add(row)
        else:
            row.score = score
            row.difficulty = difficulty
            row.last_seen_at = now
            if current_lesson_id is not None:
                row.current_lesson_id = current_lesson_id
        session.flush()
        return row
