"""The soft gate (DM-18, SG-6, DM-52): new elements come from the language's first lesson until it was known once.

Opening is persistent: the gate row is never removed by decay. Other lessons stay reachable by hand at any time;
the gate only decides which lessons the goal's menu draws NEW elements from."""
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from ...core.database import db_manager, transactional
from ...models.containers import Lesson
from ...models.system_data import LessonGate
from ...utils.scoring import KNOWN_FROM
from ..system_data import ScoreService


class GateService:
    @staticmethod
    def first_lesson_id(language_id: str, session, with_elements: Optional[list] = None) -> Optional[str]:
        """The language's first lesson (position, then creation) that holds at least one element of `with_elements` models (any lesson when None)."""
        for lesson in session.query(Lesson).filter_by(language_id=language_id).order_by(Lesson.position, Lesson.created_at, Lesson.id):
            if with_elements is None or any(session.query(m.id).filter_by(lesson_id=lesson.id).first() for m in with_elements):
                return lesson.id
        return None

    @transactional
    def gate_lesson(self, user_id: str, language_id: str, with_elements: Optional[list] = None,
                    session: Optional[Session] = None) -> Optional[str]:
        """The lesson new elements are limited to while the gate is closed, None once it is open (or when there is nothing to gate).
        Opens the gate the first time the first lesson is known."""
        first = self.first_lesson_id(language_id, session, with_elements)
        if first is None or session.query(LessonGate).filter_by(user_id=user_id, language_id=language_id).first() is not None:
            return None
        row = ScoreService().get(user_id, first, session=session)
        if row is not None and row.score >= KNOWN_FROM:
            self.unlock(user_id, language_id, first, session=session)
            return None
        return first

    @transactional
    def is_unlocked(self, user_id: str, language_id: str, lesson_id: str, with_elements: Optional[list] = None,
                    session: Optional[Session] = None) -> bool:
        """The first lesson is always offered; any other once the gate is open."""
        return self.gate_lesson(user_id, language_id, with_elements, session=session) in (None, lesson_id)

    @transactional
    def unlock(self, user_id: str, language_id: str, lesson_id: str, session: Optional[Session] = None) -> LessonGate:
        """Open the gate (idempotent: one row per learner and language)."""
        row = session.query(LessonGate).filter_by(user_id=user_id, language_id=language_id).first()
        if row is None:
            row = LessonGate(id=db_manager.generate_new_id(LessonGate, session=session), user_id=user_id, language_id=language_id,
                             unlocked_lesson_id=lesson_id, unlocked_at=datetime.now())
            session.add(row)
            session.flush()
        return row
