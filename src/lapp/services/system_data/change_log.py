"""History of what editors change in a lesson shared with them (a lesson share or a full-language collaboration) (DM-23), and the owner's revert.

Recorded by a session hook, so every service write is covered without each service knowing about sharing: when the user
making the request is a recipient (not the owner) of the lesson an element belongs to, each flushed create/update/delete of a
lesson element (vocabulary, grammar, calligraphy, exercise) writes a `ChangeLog` row. Column values only; the owner's own edits
and background jobs (no request user) are not logged. Links (tags, example sentences) are not part of the before/after.
"""
import logging
from datetime import date, datetime
from typing import Optional

from flask import g, has_request_context
from sqlalchemy import event, inspect as sa_inspect
from sqlalchemy.orm import Session

from ...core.database import db_manager, transactional
from ...models.system_data import ChangeLog, LessonShare

logger = logging.getLogger(__name__)
LOGGED = ("Vocabulary", "Grammar", "Calligraphy", "Exercise")


def _plain(value):
    return value.isoformat() if isinstance(value, (datetime, date)) else value


def _columns(obj, only_changed: bool) -> tuple[dict, dict]:
    before, after = {}, {}
    state = sa_inspect(obj)
    for col in state.mapper.column_attrs:
        hist = state.attrs[col.key].history
        if only_changed and not hist.has_changes():
            continue
        old = hist.deleted[0] if hist.deleted else (hist.unchanged[0] if hist.unchanged else None)
        new = hist.added[0] if hist.added else (hist.unchanged[0] if hist.unchanged else None)
        before[col.key], after[col.key] = _plain(old), _plain(new)
    return before, after


def _editor_of(session: Session, lesson_id: str) -> Optional[str]:
    """The request user when they edit a lesson that is shared with them and is not theirs."""
    if not has_request_context():
        return None
    uid = getattr(g, "current_user_id", None)
    if not uid:
        return None
    if session.query(LessonShare.id).filter(LessonShare.lesson_id == lesson_id, LessonShare.user_id == uid).first():
        return uid
    # a full-language collaborator edits the owner's lessons too
    from ...models.containers import Lesson
    from ...models.system_data import Collaboration
    lesson = session.query(Lesson).filter(Lesson.id == lesson_id).first()
    full = lesson is not None and session.query(Collaboration.id).filter(
        Collaboration.target_type == "language", Collaboration.target_id == lesson.language_id, Collaboration.collaborator_id == uid,
        Collaboration.status == "accepted", (Collaboration.mode.is_(None)) | (Collaboration.mode == "full")).first()
    return uid if full else None


@event.listens_for(Session, "before_flush")
def _record(session: Session, flush_context, instances) -> None:
    if session.info.get("change_log_off"):
        return
    pending = [(o, "create") for o in session.new] + [(o, "update") for o in session.dirty] + [(o, "delete") for o in session.deleted]
    for obj, op in pending:
        if type(obj).__name__ not in LOGGED or not getattr(obj, "lesson_id", None):
            continue
        if op == "update" and not session.is_modified(obj):
            continue
        editor = _editor_of(session, obj.lesson_id)
        if editor is None:
            continue
        before, after = _columns(obj, only_changed=(op == "update"))
        session.info["change_log_off"] = True        # the entry's own id lookup and insert must not recurse into this hook
        try:
            session.add(ChangeLog(id=db_manager.generate_new_id(ChangeLog, session=session), lesson_id=obj.lesson_id, user_id=editor,
                                  element_id=obj.id, op=op,
                                  before=None if op == "create" else before, after=None if op == "delete" else after))
        finally:
            session.info.pop("change_log_off", None)


class ChangeLogService:
    @transactional
    def list_for_lesson(self, lesson_id: str, session: Optional[Session] = None) -> list[dict]:
        rows = session.query(ChangeLog).filter(ChangeLog.lesson_id == lesson_id).order_by(ChangeLog.at.desc(), ChangeLog.id.desc()).all()
        return [{"id": r.id, "user_id": r.user_id, "element_id": r.element_id, "op": r.op, "before": r.before, "after": r.after,
                 "at": r.at.isoformat() if r.at else None, "reverted": r.reverted_at is not None} for r in rows]

    @transactional
    def revert(self, change_id: str, actor_id: str, session: Optional[Session] = None) -> bool:
        """Restore what the editor changed. Only the lesson's owner may; False when it is not found or was already reverted."""
        from ...models.containers import Lesson
        from ...utils.element_kinds import kind_of
        entry = session.query(ChangeLog).filter(ChangeLog.id == change_id).first()
        if entry is None or entry.reverted_at is not None:
            return False
        lesson = session.query(Lesson).filter(Lesson.id == entry.lesson_id).first()
        if lesson is None or lesson.user_id != actor_id:
            raise PermissionError("only the lesson's owner can revert a change")
        model = kind_of(entry.element_id).model()
        obj = session.query(model).filter(model.id == entry.element_id).first()
        session.info["change_log_off"] = True
        try:
            if entry.op == "create":
                if obj is not None:
                    session.delete(obj)
            elif entry.op == "update":
                if obj is None:
                    return False
                for key, value in (entry.before or {}).items():
                    setattr(obj, key, value)
            elif entry.op == "delete" and obj is None:
                session.add(model(**{k: v for k, v in (entry.before or {}).items() if k not in ("created_at", "last_seen_at")}))
            entry.reverted_at = datetime.now()
            session.flush()
        finally:
            session.info.pop("change_log_off", None)
        return True
