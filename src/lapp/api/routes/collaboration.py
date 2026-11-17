from flask import Blueprint, request, jsonify, abort

from ...services.system_data import ChangeLogService, CollaborationService
from ...services.system_data.collaboration import MERGE_CHOICES, MergeConflicts
from ...core.database import db_manager
from ...core.auth import login_required, current_user_id, owner_user_id
from ...models.system_data import User, Collaboration

bp = Blueprint('collaboration', __name__, url_prefix='/api/collaboration')
collaboration_service = CollaborationService()


def _serialize(collab: Collaboration) -> dict:
    return {
        "id": collab.id,
        "master_id": collab.master_id,
        "collaborator_id": collab.collaborator_id,
        "target_type": collab.target_type,
        "target_id": collab.target_id,
        "status": collab.status,
        "mode": collab.mode,
        "proposed_mode": collab.proposed_mode,
        "offered_lesson_ids": collab.offered_lesson_ids,
    }


@bp.route('/', methods=['POST'])
@login_required
def invite():
    data = request.json or {}
    target_type = data.get('target_type')
    target_id = data.get('target_id')
    collaborator_id = data.get('collaborator_id')

    if not target_id or not collaborator_id:
        abort(400, description="target_id and collaborator_id are required")
    if collaborator_id == current_user_id():
        abort(400, description="You cannot invite yourself")
    if target_type not in ('language', 'lesson'):
        abort(400, description="target_type must be 'language' or 'lesson'")
    prefix = "lang_" if target_type == "language" else "lesson_"
    if not target_id.startswith(prefix):
        abort(400, description="target_id does not match target_type")

    owner = owner_user_id(target_id)
    if owner is None:
        abort(404, description="Target not found")
    if owner != current_user_id():
        abort(403, description="Not your resource")

    collaborator = db_manager.get_by_id(User, collaborator_id)
    if collaborator is None:
        abort(404, description="Collaborator not found")

    try:
        collab = collaboration_service.invite(current_user_id(), collaborator_id, target_type, target_id,
                                              mode=data.get('mode'), lesson_ids=data.get('lesson_ids'))
    except ValueError as e:
        abort(400, description=str(e))
    return jsonify({'success': True, 'collaboration': _serialize(collab)})


@bp.route('/<collaboration_id>/accept', methods=['POST'])
@login_required
def accept(collaboration_id):
    collab = db_manager.get_by_id(Collaboration, collaboration_id)
    if collab is None:
        abort(404, description="Collaboration not found")
    if collab.collaborator_id != current_user_id():
        abort(403, description="Not your invitation")
    if collab.status != "pending":
        abort(403, description="Invitation already answered")
    mode = (request.get_json(silent=True) or {}).get('mode')
    if mode not in (None, 'full', 'partial'):
        abort(400, description="mode must be 'full' or 'partial'")
    lesson_ids = (request.get_json(silent=True) or {}).get('lesson_ids')
    if mode == 'partial' and lesson_ids == []:
        abort(400, description="lesson_ids must not be empty for partial mode")
    try:
        updated = collaboration_service.accept(collaboration_id, mode=mode, lesson_ids=lesson_ids)
    except ValueError as e:
        abort(400, description=str(e))
    except LookupError as e:
        abort(409, description=str(e))
    return jsonify({'success': True, 'collaboration': _serialize(updated) if updated else None})


@bp.route('/<collaboration_id>/consent', methods=['POST'])
@login_required
def consent(collaboration_id):
    collab = db_manager.get_by_id(Collaboration, collaboration_id)
    if collab is None:
        abort(404, description="Collaboration not found")
    if collab.master_id != current_user_id():
        abort(403, description="Not your collaboration")
    decisions = (request.get_json(silent=True) or {}).get('decisions') or {}
    if not isinstance(decisions, dict) or any(v not in MERGE_CHOICES for v in decisions.values()):
        abort(400, description="decisions must map element ids to keep, overwrite or merge")
    try:
        updated = collaboration_service.consent(collaboration_id, decisions=decisions)
    except MergeConflicts as e:
        # nothing was merged: the owner decides each of these (keep / overwrite / merge) and sends the decisions back
        return jsonify({'error': 'conflicts', 'conflicts': e.conflicts}), 409
    return jsonify({'success': True, 'collaboration': _serialize(updated)})


@bp.route('/<collaboration_id>/decline', methods=['POST'])
@login_required
def decline(collaboration_id):
    """Master refuses a full merge: drops the link (the invitee's language is untouched)."""
    collab = db_manager.get_by_id(Collaboration, collaboration_id)
    if collab is None:
        abort(404, description="Collaboration not found")
    if collab.master_id != current_user_id():
        abort(403, description="Not your collaboration")
    if collab.status != "awaiting_master_consent":
        abort(403, description="Nothing to decline")
    collaboration_service.reject(collaboration_id)
    return jsonify({'success': True})


@bp.route('/<collaboration_id>/reject', methods=['POST'])
@login_required
def reject(collaboration_id):
    collab = db_manager.get_by_id(Collaboration, collaboration_id)
    if collab is None:
        abort(404, description="Collaboration not found")
    if collab.collaborator_id != current_user_id():
        abort(403, description="Not your invitation")
    if collab.status == "accepted":
        abort(403, description="Already accepted — ask the master to remove you, or leave your shared lessons")
    collaboration_service.reject(collaboration_id)
    return jsonify({'success': True})


@bp.route('/<collaboration_id>', methods=['DELETE'])
@login_required
def remove(collaboration_id):
    collab = db_manager.get_by_id(Collaboration, collaboration_id)
    if collab is None:
        abort(404, description="Collaboration not found")
    if collab.master_id != current_user_id():
        abort(403, description="Not your collaboration")
    collaboration_service.remove(collaboration_id)
    return jsonify({'success': True})


@bp.route('/awaiting-consent', methods=['GET'])
@login_required
def awaiting_consent():
    return jsonify(collaboration_service.list_awaiting_consent(current_user_id()))


@bp.route('/invites', methods=['GET'])
@login_required
def invites():
    return jsonify(collaboration_service.list_invites(current_user_id()))


@bp.route('/list', methods=['GET'])
@login_required
def list_collaborators():
    target_type = request.args.get('target_type')
    target_id = request.args.get('target_id')
    if not target_type or not target_id:
        abort(400, description="target_type and target_id are required")
    owner = owner_user_id(target_id)
    if owner is None:
        abort(404, description="Target not found")
    if owner != current_user_id():
        abort(403, description="Not your resource")
    return jsonify(collaboration_service.list_collaborators(target_type, target_id))



@bp.route('/lesson/<lesson_id>/changes', methods=['GET'])
@login_required
def lesson_changes(lesson_id):
    """What editors changed in a lesson shared by the caller (newest first); the owner only."""
    if owner_user_id(lesson_id) is None:
        abort(404, description="Lesson not found")
    if owner_user_id(lesson_id) != current_user_id():
        abort(403, description="Not your resource")
    return jsonify(ChangeLogService().list_for_lesson(lesson_id))


@bp.route('/changes/<change_id>/revert', methods=['POST'])
@login_required
def revert_change(change_id):
    """Undo one editor's change; the lesson's owner only."""
    try:
        done = ChangeLogService().revert(change_id, current_user_id())
    except PermissionError as e:
        abort(403, description=str(e))
    if not done:
        abort(404, description="Nothing to revert")
    return jsonify({'success': True})
