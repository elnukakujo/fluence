from datetime import datetime
from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint

from ...core.database import Base


class LearnerDay(Base):
    """One row per learner and day on the learner's own clock (all languages together): the answers given and whether the
    day counts for the streak. Independent of the languages, so deleting one never breaks the streak (DM-22, DM-37)."""
    __tablename__ = 'learner_day'
    __table_args__ = (UniqueConstraint('user_id', 'day', name='uq_learner_day_user_day'),)

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('user.id'), nullable=False)
    day = Column(Date, nullable=False)
    answers = Column(Integer, nullable=False, default=0)
    validated = Column(Boolean, nullable=False, default=False)
    streak_length = Column(Integer, nullable=False, default=0)       # the streak as of this day, once validated
    created_at = Column(DateTime, default=datetime.now, nullable=False)
