from datetime import datetime
from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint

from ...core.database import Base


class WeeklySnapshot(Base):
    """Level counts of one language when a week closed (Sunday 23:59 learner time, DM-47): the base of every trend."""
    __tablename__ = 'weekly_snapshot'
    __table_args__ = (UniqueConstraint('user_id', 'language_id', 'week_start', name='uq_weekly_snapshot_week'),)

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('user.id'), nullable=False)
    language_id = Column(String, ForeignKey('language.id', ondelete='CASCADE'), nullable=False)
    week_start = Column(Date, nullable=False)                         # the Monday
    n_learning = Column(Integer, nullable=False, default=0)           # seen elements by level
    n_known = Column(Integer, nullable=False, default=0)
    n_mastered = Column(Integer, nullable=False, default=0)
    n_fading = Column(Integer, nullable=False, default=0)             # succeeded once, below known now
    n_seen = Column(Integer, nullable=False, default=0)
    n_total = Column(Integer, nullable=False, default=0)              # elements of the language (coverage = seen / total)
    created_at = Column(DateTime, default=datetime.now, nullable=False)

    def to_dict(self) -> dict:
        return {"week_start": self.week_start.isoformat(), "n_learning": self.n_learning, "n_known": self.n_known,
                "n_mastered": self.n_mastered, "n_fading": self.n_fading, "n_seen": self.n_seen, "n_total": self.n_total}
