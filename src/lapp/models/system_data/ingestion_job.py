from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from ...core.database import Base

JOB_STATUSES = ("queued", "parsing", "structure", "extracting", "ready", "failed")


class IngestionJob(Base):
    """One uploaded document being turned into vocabulary candidates (files live under MEDIA_ROOT/ingestion/<id>/)."""
    __tablename__ = 'ingestion_job'

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('user.id', ondelete='CASCADE'), nullable=False, index=True)
    language_id = Column(String, ForeignKey('language.id', ondelete='CASCADE'), nullable=False)
    lesson_id = Column(String, ForeignKey('lesson.id', ondelete='SET NULL'), nullable=True)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)          # relative to MEDIA_ROOT
    handwritten = Column(Boolean, nullable=False, default=False)
    page_from = Column(Integer, nullable=True)           # 1-based, inclusive; null = whole document
    page_to = Column(Integer, nullable=True)
    status = Column(String, nullable=False, default='queued')
    pages_done = Column(Integer, nullable=False, default=0)
    pages_total = Column(Integer, nullable=False, default=0)
    error = Column(Text, nullable=True)
    # language-level imports: proposed/confirmed lessons {confirmed, first_page, last_page, lessons:[...]}
    structure = Column(JSON, nullable=True)
    # {"1-based page": [kind, ...]} from the per-page kind classifier; null until classified
    page_kinds = Column(JSON, nullable=True)
    warnings = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    def to_dict(self, include_relations: bool = True) -> dict:
        return {
            "id": self.id, "user_id": self.user_id, "language_id": self.language_id,
            "lesson_id": self.lesson_id, "filename": self.filename, "file_path": self.file_path,
            "handwritten": self.handwritten, "page_from": self.page_from, "page_to": self.page_to, "status": self.status,
            "pages_done": self.pages_done, "pages_total": self.pages_total,
            "error": self.error, "structure": self.structure, "page_kinds": self.page_kinds, "warnings": self.warnings or [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
