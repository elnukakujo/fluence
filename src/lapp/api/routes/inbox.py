from flask import Blueprint, jsonify, request

from ...core.auth import current_user_id, login_required
from ...core.database import db_manager
from ...models.containers import Lesson
from ...models.features import Exercise
from ...services import ExerciseService

bp = Blueprint('inbox', __name__, url_prefix='/api/inbox')


def _mine(session, ids: list[str] | None = None):
    q = (session.query(Exercise).join(Lesson, Lesson.id == Exercise.lesson_id)
         .filter(Lesson.user_id == current_user_id(), Exercise.draft.is_(True)))
    return q.filter(Exercise.id.in_(ids)).all() if ids is not None else q.all()


@bp.route('', methods=['GET'])
@login_required
def list_drafts():
    """AI-made material waiting for acceptance, grouped by kind. `count` feeds the nav badge.
    ---
    tags:
      - Inbox
    responses:
      200: {description: "{count, groups: {exercise: [...]}}"}
    """
    with db_manager.session_scope() as s:
        exercises = [e.to_dict(include_relations=False) for e in _mine(s)]
    return jsonify({"count": len(exercises), "groups": {"exercise": exercises}})


def _ids():
    ids = (request.get_json(silent=True) or {}).get("ids")
    return ids if isinstance(ids, list) and all(isinstance(i, str) for i in ids) else None


@bp.route('/accept', methods=['POST'])
@login_required
def accept():
    """Accept drafts (one or many): they enter study. They keep `machine_made`.
    ---
    tags:
      - Inbox
    responses:
      200: {description: "{accepted: n}"}
      400: {description: ids missing}
    """
    ids = _ids()
    if ids is None:
        return jsonify({"error": "ids must be a list of ids"}), 400
    with db_manager.session_scope() as s:
        rows = _mine(s, ids)           # only the caller's own drafts: anything else is silently not matched
        for e in rows:
            e.draft = False
            e.review_reason = None
        return jsonify({"accepted": len(rows)})


@bp.route('/reject', methods=['POST'])
@login_required
def reject():
    """Reject drafts: they are deleted.
    ---
    tags:
      - Inbox
    responses:
      200: {description: "{rejected: n}"}
      400: {description: ids missing}
    """
    ids = _ids()
    if ids is None:
        return jsonify({"error": "ids must be a list of ids"}), 400
    with db_manager.session_scope() as s:
        rows = _mine(s, ids)
        service = ExerciseService()
        for e in rows:
            service.delete(e.id, session=s)
        return jsonify({"rejected": len(rows)})
