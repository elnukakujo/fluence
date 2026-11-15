from sqlalchemy import Boolean, Column, Date, String, Float, DateTime, ForeignKey, UniqueConstraint
from datetime import datetime

from ...core.database import Base


class Score(Base):
    """Per-user current state for any element (shared or not).

    One row per (user, element, skill): the score as of `last_seen_at` (decay is computed on read, never stored),
    its stability, the leech flag and the same-day gain counter. `skill` defaults to "recall" until ScoreService
    writes per skill.
    The evolution over time is `ProgressTracking`, not this table.
    """
    __tablename__ = 'score'
    __table_args__ = (
        UniqueConstraint('user_id', 'element_id', 'skill', name='uq_score_user_element_skill'),
    )

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('user.id'), nullable=False)
    element_id = Column(String, nullable=False)  # polymorphic, no FK (resolve_element_model)
    skill = Column(String, nullable=False, default="recall", server_default="recall")
    score = Column(Float, default=0.0, nullable=False)
    stability = Column(Float, nullable=False, default=2.0, server_default="2.0")  # days for the score to halve
    is_leech = Column(Boolean, nullable=False, default=False, server_default="false")
    recent = Column(String, nullable=False, default="", server_default="")  # last 8 outcomes "0"/"1", newest last
    day_date = Column(Date, nullable=True)  # learner-local day of day_gain
    day_gain = Column(Float, nullable=False, default=0.0, server_default="0")
    difficulty = Column(Float, default=0.5, nullable=False)
    created_at = Column(DateTime, default=datetime.now, nullable=False)  # first engagement
    last_seen_at = Column(DateTime, nullable=True)
    current_lesson_id = Column(String, nullable=True)  # only for language rows
    note = Column(String, nullable=True)  # the user's own mnemonic for this element (personal, so it lives with the score)
