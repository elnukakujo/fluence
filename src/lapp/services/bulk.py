"""Bulk actions on a lesson's vocabulary / grammar / calligraphy / exercise rows (all-or-nothing)."""
from typing import Optional

from sqlalchemy.orm import Session

from ..core.database import transactional
from ..models.containers import Lesson
from ..models.features import Calligraphy, Exercise, Grammar, Vocabulary

_MODELS = {"voc_": Vocabulary, "gram_": Grammar, "call_": Calligraphy, "ex_": Exercise}


def model_of(element_id: str):
    return next((m for p, m in _MODELS.items() if isinstance(element_id, str) and element_id.startswith(p)), None)


class BulkElementService:
    def _rows(self, ids: list[str], session: Session) -> list:
        rows = []
        for i in ids:
            model = model_of(i)
            row = session.get(model, i) if model else None
            if row is None:
                raise LookupError(i)
            rows.append(row)
        return rows

    def _rescore(self, lesson_ids, user_id: Optional[str], session: Session) -> None:
        from .containers import LessonService
        if user_id:
            for lid in set(lesson_ids):
                LessonService().update_score(lid, user_id=user_id, touch=False, session=session)

    @transactional
    def delete(self, ids: list[str], user_id: Optional[str] = None, session: Optional[Session] = None) -> int:
        rows = self._rows(ids, session)
        lessons = [r.lesson_id for r in rows]
        for r in rows:
            session.delete(r)
        session.flush()
        self._rescore(lessons, user_id, session)
        return len(rows)

    @transactional
    def edit_links(self, ids: list[str], attr: str, add: list[str], remove: list[str],
                   session: Optional[Session] = None) -> int:
        """Add / remove tags (`attr="tags"`) or sources (`"sources"`); no duplicate links, absent ones ignored."""
        from ..models.system_data import Source, Tag
        target = Tag if attr == "tags" else Source
        to_add = [session.get(target, i) for i in add]
        if None in to_add:
            raise LookupError("link")
        rows = self._rows(ids, session)
        for r in rows:
            current = list(getattr(r, attr))
            kept = [x for x in current if x.id not in set(remove)]
            have = {x.id for x in kept}
            setattr(r, attr, kept + [x for x in to_add if x.id not in have])
        session.flush()
        return len(rows)

    @transactional
    def move(self, ids: list[str], target_lesson_id: str, user_id: Optional[str] = None,
             session: Optional[Session] = None) -> dict:
        """Re-point rows to `target_lesson_id` (same language). ValueError when invalid."""
        target = session.get(Lesson, target_lesson_id)
        rows = self._rows(ids, session)
        if target is None:
            raise LookupError(target_lesson_id)
        sources = {r.lesson_id for r in rows}
        if target_lesson_id in sources:
            raise ValueError("Some items are already in that lesson")
        if any(session.get(Lesson, lid).language_id != target.language_id for lid in sources):
            raise ValueError("Moving to another language is not supported yet")
        for r in rows:
            r.lesson_id = target_lesson_id
        session.flush()
        self._rescore([*sources, target_lesson_id], user_id, session)
        return {"moved": len(rows), "skipped": []}
