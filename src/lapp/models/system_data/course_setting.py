from sqlalchemy import JSON, Column, ForeignKey, String, UniqueConstraint

from ...core.database import Base


class CourseSetting(Base):
    """A course-scope setting (US-R2): overrides the account value for one language; no row = inherit."""
    __tablename__ = 'course_setting'
    __table_args__ = (UniqueConstraint('user_id', 'language_id', 'key', name='uq_course_setting'),)

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('user.id'), nullable=False)
    language_id = Column(String, ForeignKey('language.id', ondelete='CASCADE'), nullable=False)
    key = Column(String, nullable=False)
    value = Column(JSON, nullable=True)
