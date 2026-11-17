from sqlalchemy import JSON, Column, DateTime, ForeignKey, String
from sqlalchemy.sql import func

from ...core.database import Base


class ChangeLog(Base):
    """One edit an editor made to an element of a lesson shared with them (DM-23): who, what, before and after. The owner can revert it."""
    __tablename__ = 'change_log'

    id = Column(String, primary_key=True, index=True)
    lesson_id = Column(String, ForeignKey('lesson.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = Column(String, ForeignKey('user.id'), nullable=False)       # the editor
    element_id = Column(String, nullable=False)
    op = Column(String, nullable=False)                                    # 'create' | 'update' | 'delete'
    before = Column(JSON, nullable=True)                                   # column values before ('update': changed columns only; 'delete': the whole row)
    after = Column(JSON, nullable=True)
    reverted_at = Column(DateTime, nullable=True)
    at = Column(DateTime, nullable=False, server_default=func.now())
