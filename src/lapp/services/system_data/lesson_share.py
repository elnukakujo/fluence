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
    def list_shared_lessons(self, user_id: str, session: Optional[Session] = None) -> list[dict]:
        """Return dicts for the lessons shared with `user_id` (serialized inside the session)."""
        from ...models.containers import Lesson, Language
        rows = session.query(LessonShare).filter(LessonShare.user_id == user_id).all()
        ids = [r.lesson_id for r in rows]
        if not ids:
            return []
        lessons = session.query(Lesson).filter(Lesson.id.in_(ids)).all()
        langs = {l.id: l for l in session.query(Language).filter(
            Language.id.in_([le.language_id for le in lessons])).all()}
        result = []
        for le in lessons:
            d = le.to_dict()
            lang = langs.get(le.language_id)
            # The frontend groups shared lessons under the invitee's language of the
            # same target ISO, so carry it alongside the (master's) language_id.
            d["target_iso639_2t"] = lang.target_iso639_2t if lang else None
            result.append(d)
        return result

    @transactional
    def list_recipients(self, lesson_id: str, session: Optional[Session] = None) -> list[dict]:
        from ...models.system_data import User
        rows = session.query(LessonShare, User).join(User, User.id == LessonShare.user_id).filter(
            LessonShare.lesson_id == lesson_id).all()
        return [{"user_id": u.id, "name": u.display_name or u.username} for _, u in rows]
