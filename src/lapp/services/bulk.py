"""Bulk actions on a lesson's vocabulary / grammar / calligraphy / exercise rows (all-or-nothing)."""
from typing import Optional

from sqlalchemy.orm import Session

from ..core.database import transactional
from .system_data.score import ScoreService
from ..models.containers import Language, Lesson
from ..models.features import Calligraphy, Exercise, Grammar, Vocabulary

_MODELS = {"voc_": Vocabulary, "gram_": Grammar, "call_": Calligraphy, "ex_": Exercise}


_CONTAINERS = {"lesson_": Lesson, "lang_": Language}   # only tags / sources apply to these


def model_of(element_id: str, containers: bool = False):
    models = {**_MODELS, **_CONTAINERS} if containers else _MODELS
    return next((m for p, m in models.items() if isinstance(element_id, str) and element_id.startswith(p)), None)


class BulkElementService:
    def _rows(self, ids: list[str], session: Session, containers: bool = False) -> list:
        rows = []
        for i in ids:
            model = model_of(i, containers)
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
        ScoreService().delete_for([r.id for r in rows], session=session)
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
        rows = self._rows(ids, session, containers=True)
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


_SOURCE_TYPES = ("original", "textbook", "class", "online", "media", "social", "other", "ai")


@transactional
def delete_labels(kind: str, ids: list[str], session: Optional[Session] = None) -> int:
    """Delete tags (`kind="tag"`) or sources: their element links go with them, the elements stay. LookupError if one is missing."""
    from sqlalchemy import delete
    from ..models.base import source_element_link, tag_element_link
    from ..models.system_data import Source, Tag

    model, link, fk = (Tag, tag_element_link, "tag_id") if kind == "tag" else (Source, source_element_link, "source_id")
    rows = [session.get(model, i) for i in ids]
    if None in rows:
        raise LookupError(ids[rows.index(None)])
    session.execute(delete(link).where(link.c[fk].in_(ids)))
    for r in rows:
        session.delete(r)
    session.flush()
    return len(rows)


@transactional
def reorder_labels(kind: str, user_id: str, ids: list[str], session: Optional[Session] = None) -> bool:
    """Give the user's tags (`kind="tag"`) or sources the order of `ids`, which must be exactly their own ids (once each)."""
    from ..models.system_data import Source, Tag
    model = Tag if kind == "tag" else Source
    rows = {r.id: r for r in session.query(model).filter(model.user_id == user_id).all()}
    if not ids or len(ids) != len(set(ids)) or set(ids) != set(rows):
        return False
    for position, i in enumerate(ids):
        rows[i].position = position
    return True


@transactional
def merge_labels(kind: str, keep_id: str, merge_id: str, changes: dict, session: Optional[Session] = None) -> dict:
    """Fold tag / source `merge_id` into `keep_id` (same user): every element link moves (no duplicate), the other row is
    deleted, `changes` (name / color / description, or title / date / source_type / description) are applied to the survivor.
    LookupError if a row is missing, ValueError if the request is invalid."""
    from datetime import date as _date, datetime
    from sqlalchemy import delete, insert, select
    from ..models.base import source_element_link, tag_element_link
    from ..models.system_data import Source, Tag

    model, link, fk, name_col = (Tag, tag_element_link, "tag_id", "name") if kind == "tag" else (Source, source_element_link, "source_id", "title")
    if keep_id == merge_id:
        raise ValueError("Pick two different items")
    keep, other = session.get(model, keep_id), session.get(model, merge_id)
    if keep is None or other is None:
        raise LookupError(keep_id if keep is None else merge_id)
    if keep.user_id != other.user_id:
        raise ValueError("Both must belong to the same user")

    changes = {k: v for k, v in changes.items() if v is not None}
    if name_col in changes:
        changes[name_col] = str(changes[name_col]).strip()
        if not changes[name_col]:
            raise ValueError("The name cannot be blank")
        if kind == "tag" and session.query(Tag).filter(Tag.user_id == keep.user_id, Tag.name == changes["name"],
                                                       Tag.id.notin_([keep_id, merge_id])).first():
            raise ValueError("That name is already used by another tag")
    if "source_type" in changes and changes["source_type"] not in _SOURCE_TYPES:
        raise ValueError("Invalid source type")
    if "date" in changes:
        try:
            changes["date"] = _date.fromisoformat(str(changes["date"])[:10])
        except ValueError:
            raise ValueError("Invalid date")

    col = link.c[fk]
    already = select(link.c.element_id).where(col == keep_id)
    for (element_id,) in session.execute(select(link.c.element_id).where(col == merge_id, link.c.element_id.notin_(already))).all():
        session.execute(insert(link).values({fk: keep_id, "element_id": element_id}))
    session.execute(delete(link).where(col == merge_id))
    session.delete(other)
    session.flush()          # frees the loser's name before the survivor takes it
    for k, v in changes.items():
        setattr(keep, k, v)
    keep.updated_at = datetime.utcnow()
    session.flush()
    session.expire(keep)
    return keep.to_dict()
