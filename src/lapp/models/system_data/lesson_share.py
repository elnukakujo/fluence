from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func

from ...core.database import Base


class LessonShare(Base):
    """Marks a lesson as co-editable by a second user (partial collaboration).

    Single-source: the lesson still lives in its owner's language; this row is
    the pointer that grants the sharee write access (see `require_write`).
    """
    __tablename__ = 'lesson_share'
    __table_args__ = (
        UniqueConstraint('lesson_id', 'user_id', name='uq_lesson_share_lesson_user'),
    )

    id = Column(String, primary_key=True, index=True)
    lesson_id = Column(String, ForeignKey('lesson.id'), nullable=False)
    user_id = Column(String, ForeignKey('user.id'), nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
