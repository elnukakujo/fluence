from typing import Optional

from sqlalchemy.orm import Session

from ...core.database import db_manager, transactional
from ...models.system_data import Collaboration


class CollaborationService:
    @transactional
    def invite(self, master_id: str, collaborator_id: str, target_type: str, target_id: str,
               session: Optional[Session] = None) -> Collaboration:
        """Invite a collaborator (idempotent)."""
        existing = session.query(Collaboration).filter(
            Collaboration.master_id == master_id,
            Collaboration.collaborator_id == collaborator_id,
            Collaboration.target_type == target_type,
            Collaboration.target_id == target_id,
        ).first()
        if existing:
            return existing
        collab = Collaboration(
            id=db_manager.generate_new_id(Collaboration, session=session),
            master_id=master_id,
            collaborator_id=collaborator_id,
            target_type=target_type,
            target_id=target_id,
            status="pending",
        )
        session.add(collab)
        session.flush()
        return collab

    @transactional
    def accept(self, collaboration_id: str, session: Optional[Session] = None) -> Optional[Collaboration]:
        collab = session.query(Collaboration).filter(Collaboration.id == collaboration_id).first()
        if collab:
            collab.status = "accepted"
            session.flush()
        return collab

    @transactional
    def reject(self, collaboration_id: str, session: Optional[Session] = None) -> bool:
        collab = session.query(Collaboration).filter(Collaboration.id == collaboration_id).first()
        if not collab:
            return False
        session.delete(collab)
        return True

    @transactional
    def remove(self, collaboration_id: str, session: Optional[Session] = None) -> bool:
        # TODO: fork the shared container into the collaborator's account (Task 4).
        collab = session.query(Collaboration).filter(Collaboration.id == collaboration_id).first()
        if not collab:
            return False
        session.delete(collab)
        return True

    def is_collaborator(self, user_id: str, target_type: str, target_id: str,
                        session: Optional[Session] = None) -> bool:
        if session is not None:
            return self._is_collaborator(user_id, target_type, target_id, session)
        with db_manager.session_scope() as s:
            return self._is_collaborator(user_id, target_type, target_id, s)

    def _is_collaborator(self, user_id, target_type, target_id, session) -> bool:
        return session.query(Collaboration).filter(
            Collaboration.collaborator_id == user_id,
            Collaboration.target_type == target_type,
            Collaboration.target_id == target_id,
            Collaboration.status == "accepted",
        ).first() is not None

    @transactional
    def list_collaborators(self, target_type: str, target_id: str,
                           session: Optional[Session] = None) -> list[dict]:
        collabs = session.query(Collaboration).filter(
            Collaboration.target_type == target_type,
            Collaboration.target_id == target_id,
            Collaboration.status == "accepted",
        ).all()
        return [{"id": c.id, "collaborator_id": c.collaborator_id} for c in collabs]

    @transactional
    def list_invites(self, user_id: str, session: Optional[Session] = None) -> list[dict]:
        collabs = session.query(Collaboration).filter(
            Collaboration.collaborator_id == user_id,
            Collaboration.status == "pending",
        ).all()
        return [{"id": c.id, "master_id": c.master_id, "target_type": c.target_type,
                 "target_id": c.target_id} for c in collabs]
