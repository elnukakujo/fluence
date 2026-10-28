from sqlalchemy import Column, String, DateTime, ForeignKey, Float

from ...core.database import Base


class CollaborationProgress(Base):
    __tablename__ = 'collaboration_progress'

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('user.id'), nullable=False)
    element_id = Column(String, nullable=False)
    score = Column(Float, default=0.0, nullable=False)
    difficulty = Column(Float, default=0.5, nullable=False)
    last_seen_at = Column(DateTime, nullable=True)
