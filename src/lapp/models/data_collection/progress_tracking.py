from sqlalchemy import Column, String, Integer, Float, Boolean

from ..base import BaseDataCollectionModel
from ...core.database import db_manager
from ...utils import resolve_element_model

class ProgressTracking(BaseDataCollectionModel):
    __tablename__ = 'progress_tracking'

    element_type = Column(String, nullable=False)
    element_status = Column(String, nullable=False)
    score_before = Column(Float, nullable=False)
    score_after = Column(Float, nullable=False)
    result = Column(Boolean, nullable=False)
    duration_ms = Column(Float, nullable=False)
    hint_used = Column(Boolean, nullable=True)
    attempt_number = Column(Integer, nullable=True)
    session_completed = Column(Boolean, nullable=True)
    skill = Column(String, nullable=True)
    evidence_type = Column(String, nullable=True)
    level_before = Column(String, nullable=True)
    level_after = Column(String, nullable=True)

    # Foreign keys
    element_id = Column(String, nullable=False)  # No FK — BaseElementModel is abstract

    def get_element(self):
        """Resolve element_id to its concrete model instance."""
        if not self.element_id:
            return None

        model_class = resolve_element_model(self.element_id)
        if model_class is None:
            raise ValueError(f"Unknown element prefix in id '{self.element_id}'")

        # Reuse self's own session (see the equivalent comment on
        # BaseElementModel.get_progress_tracking in models/base.py) — an
        # "independent" session here would really be the same thread-local
        # scoped session as an active caller transaction, and closing it
        # prematurely silently discards that transaction's pending writes.
        from sqlalchemy.orm import object_session
        return db_manager.find_by_attr(model_class, {"id": self.element_id}, session=object_session(self))

    def to_dict(self, include_relations: bool = True) -> dict:
        base = {
            **super().to_dict(),
            "element_id": self.element_id,
            "element_type": self.element_type,
            "element_status": self.element_status,
            "score_before": self.score_before,
            "score_after": self.score_after,
            "result": self.result,
            "duration_ms": self.duration_ms,
            "hint_used": self.hint_used,
            "attempt_number": self.attempt_number,
            "session_completed": self.session_completed,
        }
        if include_relations:
            base["element"] = self.get_element().to_dict() if self.get_element() else None
        return base