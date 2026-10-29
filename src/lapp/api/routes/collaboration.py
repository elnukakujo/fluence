from flask import Blueprint, request, jsonify, abort

from ...services.system_data import CollaborationService
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
    }


@bp.route('/', methods=['POST'])
@login_required
def invite():
    data = request.json or {}
    target_type = data.get('target_type')
    target_id = data.get('target_id')
    collaborator_id = data.get('collaborator_id')

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

    collab = collaboration_service.invite(current_user_id(), collaborator_id, target_type, target_id)
    return jsonify({'success': True, 'collaboration': _serialize(collab)})


@bp.route('/<collaboration_id>/accept', methods=['POST'])
@login_required
def accept(collaboration_id):
    collab = db_manager.get_by_id(Collaboration, collaboration_id)
    if collab is None:
        abort(404, description="Collaboration not found")
    if collab.collaborator_id != current_user_id():
        abort(403, description="Not your invitation")
    mode = (request.get_json(silent=True) or {}).get('mode')
    if mode not in (None, 'full', 'partial'):
        abort(400, description="mode must be 'full' or 'partial'")
    updated = collaboration_service.accept(collaboration_id, mode=mode)
    return jsonify({'success': True, 'collaboration': _serialize(updated)})


@bp.route('/<collaboration_id>/consent', methods=['POST'])
@login_required
def consent(collaboration_id):
    collab = db_manager.get_by_id(Collaboration, collaboration_id)
    if collab is None:
        abort(404, description="Collaboration not found")
    if collab.master_id != current_user_id():
        abort(403, description="Not your collaboration")
    updated = collaboration_service.consent(collaboration_id)
    return jsonify({'success': True, 'collaboration': _serialize(updated)})


@bp.route('/<collaboration_id>/reject', methods=['POST'])
@login_required
def reject(collaboration_id):
    collab = db_manager.get_by_id(Collaboration, collaboration_id)
    if collab is None:
        abort(404, description="Collaboration not found")
    if collab.collaborator_id != current_user_id():
        abort(403, description="Not your invitation")
    if collab.status == "accepted":
        abort(403, description="Already accepted — the master must remove you (or leave, which forks)")
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
