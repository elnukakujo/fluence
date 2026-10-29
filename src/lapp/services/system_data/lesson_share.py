from typing import Optional

from sqlalchemy.orm import Session

from ...core.database import db_manager, transactional
from ...models.system_data import LessonShare


class LessonShareService:
    """Read/write the lesson_share pointer for partial collaboration."""

    @transactional
    def share(self, lesson_id: str, user_id: str, session: Optional[Session] = None) -> LessonShare:
        """Mark a lesson as co-editable by `user_id` (idempotent)."""
        existing = session.query(LessonShare).filter(
            LessonShare.lesson_id == lesson_id,
            LessonShare.user_id == user_id,
        ).first()
        if existing:
            return existing
        ls = LessonShare(
            id=db_manager.generate_new_id(LessonShare, session=session),
            lesson_id=lesson_id,
            user_id=user_id,
        )
        session.add(ls)
        session.flush()
        return ls

    @transactional
    def unshare(self, lesson_id: str, user_id: str, session: Optional[Session] = None) -> bool:
        ls = session.query(LessonShare).filter(
            LessonShare.lesson_id == lesson_id,
            LessonShare.user_id == user_id,
        ).first()
        if not ls:
            return False
        session.delete(ls)
        session.flush()
        return True

    @transactional
    def is_recipient(self, user_id: str, lesson_id: str, session: Optional[Session] = None) -> bool:
        return session.query(LessonShare).filter(
            LessonShare.lesson_id == lesson_id,
            LessonShare.user_id == user_id,
        ).first() is not None

    @transactional
    def list_shared_lesson_ids(self, user_id: str, session: Optional[Session] = None) -> list[str]:
        rows = session.query(LessonShare).filter(LessonShare.user_id == user_id).all()
        return [r.lesson_id for r in rows]

    @transactional
    def list_shared_lessons(self, user_id: str, session: Optional[Session] = None) -> list:
        """Return the Lesson objects shared with `user_id` (single-source pointers)."""
        from ...models.containers import Lesson
        rows = session.query(LessonShare).filter(LessonShare.user_id == user_id).all()
        ids = [r.lesson_id for r in rows]
        if not ids:
            return []
        return session.query(Lesson).filter(Lesson.id.in_(ids)).all()
