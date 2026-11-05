from sqlalchemy import Column, String, ForeignKey, UniqueConstraint

from ...core.database import Base


class ExerciseUserPref(Base):
    """A user's own `boost` / `ban` on one exercise (per user, never shared)."""
    __tablename__ = 'exercise_user_pref'
    __table_args__ = (UniqueConstraint('user_id', 'exercise_id', name='uq_exercise_user_pref'),)

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('user.id'), nullable=False)
    exercise_id = Column(String, nullable=False)   # no FK, like Score.element_id
    mode = Column(String, nullable=False)          # "boost" | "ban"
