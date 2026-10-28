from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.sql import func

from ...core.database import Base


class Collaboration(Base):
    __tablename__ = 'collaboration'

    id = Column(String, primary_key=True, index=True)
    master_id = Column(String, ForeignKey('user.id'), nullable=False)
    collaborator_id = Column(String, ForeignKey('user.id'), nullable=False)
    target_type = Column(String, nullable=False)  # 'language' | 'lesson'
    target_id = Column(String, nullable=False)
    status = Column(String, nullable=False, default='pending')  # 'pending' | 'accepted'
    created_at = Column(DateTime, nullable=False, server_default=func.now())
