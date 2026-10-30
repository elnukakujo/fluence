from sqlalchemy import Column, String, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func

from ...core.database import Base


class Collaboration(Base):
    __tablename__ = 'collaboration'

    id = Column(String, primary_key=True, index=True)
    master_id = Column(String, ForeignKey('user.id'), nullable=False)
    collaborator_id = Column(String, ForeignKey('user.id'), nullable=False)
    target_type = Column(String, nullable=False)  # 'language' | 'lesson'
    target_id = Column(String, nullable=False)
    status = Column(String, nullable=False, default='pending')  # 'pending' | 'accepted' | 'awaiting_master_consent'
    mode = Column(String, nullable=True)  # 'full' | 'partial' (sticky per target)
    proposed_mode = Column(String, nullable=True)  # master's offer: 'full' | 'partial' | NULL (legacy/lesson)
    offered_lesson_ids = Column(JSON, nullable=True)  # lesson ids offered when proposed_mode == 'partial'
    created_at = Column(DateTime, nullable=False, server_default=func.now())
