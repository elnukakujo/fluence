from sqlalchemy import Column, String, ForeignKey, UniqueConstraint

from ...core.database import Base


class OverrideFlag(Base):
    """A learner's "I was right" on one attempt of an exercise: written when it is credited, so a second call credits nothing."""
    __tablename__ = 'override_flag'
    __table_args__ = (UniqueConstraint('user_id', 'exercise_id', 'attempt_id', name='uq_override_flag'),)

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('user.id'), nullable=False)
    exercise_id = Column(String, nullable=False)   # no FK, like Score.element_id
    attempt_id = Column(String, nullable=False)    # chosen by the client, one per runner attempt
