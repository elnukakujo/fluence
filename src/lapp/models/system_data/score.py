from sqlalchemy import Column, String, Float, DateTime, ForeignKey, UniqueConstraint
from datetime import datetime

from ...core.database import Base


class Score(Base):
    """Per-user current state for any element (shared or not).

    One row per (user, element): the current SRS score/difficulty/last_seen_at.
    The evolution over time is `ProgressTracking`, not this table.
    """
    __tablename__ = 'score'
    __table_args__ = (
        UniqueConstraint('user_id', 'element_id', name='uq_score_user_element'),
    )

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('user.id'), nullable=False)
    element_id = Column(String, nullable=False)  # polymorphic, no FK (resolve_element_model)
    score = Column(Float, default=0.0, nullable=False)
    difficulty = Column(Float, default=0.5, nullable=False)
    created_at = Column(DateTime, default=datetime.now, nullable=False)  # first engagement
    last_seen_at = Column(DateTime, nullable=True)
    current_lesson_id = Column(String, nullable=True)  # only for language rows
