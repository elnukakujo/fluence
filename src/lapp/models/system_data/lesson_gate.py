from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, String, UniqueConstraint

from ...core.database import Base


class LessonGate(Base):
    """The soft gate of a learner's language is open (DM-52): the first lesson was known once. Persistent: decay never closes it."""
    __tablename__ = 'lesson_gate'
    __table_args__ = (UniqueConstraint('user_id', 'language_id', name='uq_lesson_gate_user_language'),)

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('user.id'), nullable=False)
    language_id = Column(String, ForeignKey('language.id', ondelete='CASCADE'), nullable=False)
    unlocked_lesson_id = Column(String, nullable=False)      # the lesson that was known (no FK: the lesson may be deleted later)
    unlocked_at = Column(DateTime, default=datetime.now, nullable=False)
