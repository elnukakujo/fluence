from datetime import date, datetime
from sqlalchemy import Column, String, Integer, Date, DateTime, Boolean, ForeignKey

from ...core.database import Base


class StudyGoal(Base):
    """One goal per user and language: a shared period, separate quantities per element type."""
    __tablename__ = 'study_goal'

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('user.id'), nullable=False)
    language_id = Column(String, ForeignKey('language.id', ondelete='CASCADE'), nullable=False)
    period = Column(String, nullable=False)        # "week" | "biweek" | "month"
    start_date = Column(Date, default=date.today, nullable=False)
    n_vocabulary = Column(Integer, default=0, nullable=False)
    n_grammar = Column(Integer, default=0, nullable=False)
    n_calligraphy = Column(Integer, default=0, nullable=False)
    active = Column(Boolean, default=True, nullable=False)


class StudyGoalItem(Base):
    """An element picked for a goal; stays until mastered."""
    __tablename__ = 'study_goal_item'

    id = Column(String, primary_key=True, index=True)
    goal_id = Column(String, ForeignKey('study_goal.id', ondelete='CASCADE'), nullable=False)
    element_id = Column(String, nullable=False)
    cycle_start = Column(Date, nullable=False)
    picked_at = Column(DateTime, default=datetime.now, nullable=False)
