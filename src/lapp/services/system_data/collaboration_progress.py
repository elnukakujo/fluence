from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from ...core.database import db_manager, transactional
from ...models.system_data import CollaborationProgress
from ...utils.helpers import update_score, update_difficulty


class CollaborationProgressService:
    @transactional
    def record(self, user_id: str, element_id: str, similarity: float,
               session: Optional[Session] = None) -> CollaborationProgress:
        """Create/update a collaborator's per-element score (never the master's element)."""
        now = datetime.now()
        cp = session.query(CollaborationProgress).filter(
            CollaborationProgress.user_id == user_id,
            CollaborationProgress.element_id == element_id,
        ).first()
        if cp is None:
            cp = CollaborationProgress(
                id=db_manager.generate_new_id(CollaborationProgress, session=session),
                user_id=user_id,
                element_id=element_id,
                score=0.0,
                difficulty=0.5,
                last_seen_at=now,
            )
            session.add(cp)
            session.flush()

        cp.score = update_score(
            score=cp.score,
            last_seen_at=now,
            similarity=similarity,
            created_at=now,
            difficulty=cp.difficulty,
        )
        cp.difficulty = update_difficulty(
            new_score=cp.score,
            last_seen_at=now,
            previous_difficulty=cp.difficulty,
            created_at=now,
        )
        cp.last_seen_at = now
        session.flush()
        return cp
