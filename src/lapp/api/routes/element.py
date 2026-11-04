from flask import Blueprint, jsonify, request

from ...core.auth import current_user_id, login_required, require_owns
from ...services.bulk import BulkElementService, model_of

bp = Blueprint('element', __name__, url_prefix='/api/elements')
service = BulkElementService()


def _ids(body: dict, containers: bool = False):
    ids = body.get('ids')
    if not isinstance(ids, list) or not ids or not all(model_of(i, containers) for i in ids):
        return None
    return list(dict.fromkeys(ids))


def _ids_list(body: dict, key: str):
    v = body.get(key, [])
    return v if isinstance(v, list) and all(isinstance(i, str) for i in v) else None


def _run(fn):
    try:
        return jsonify(fn())
    except LookupError:
        return jsonify({'error': 'Not found'}), 404
    except ValueError as e:
        return jsonify({'error': str(e)}), 400


@bp.route('/bulk-delete', methods=['POST'])
@login_required
def bulk_delete():
    """Delete several lesson items at once (all or nothing).
    ---
    tags:
      - Elements
    parameters:
      - {name: body, in: body, required: true, schema: {type: object, properties: {ids: {type: array, items: {type: string}}}}}
    responses:
        200: {description: "{deleted: n}"}
        400: {description: Empty or invalid ids}
        403: {description: Not the owner of every item}
    """
    body = request.get_json(silent=True) or {}
    ids = _ids(body)
    if ids is None:
        return jsonify({'error': 'ids must be a non-empty list of lesson item ids'}), 400
    for i in ids:
        require_owns(i)
    return _run(lambda: {'deleted': service.delete(ids, user_id=current_user_id())})


def _links(attr: str):
    body = request.get_json(silent=True) or {}
    ids, add, remove = _ids(body, containers=True), _ids_list(body, 'add'), _ids_list(body, 'remove')
    if ids is None or add is None or remove is None or not (add or remove):
        return jsonify({'error': 'ids and add / remove lists are required'}), 400
    for i in [*ids, *add, *remove]:
        require_owns(i)
    return _run(lambda: {'updated': service.edit_links(ids, attr, add, remove)})


@bp.route('/bulk-tags', methods=['POST'])
@login_required
def bulk_tags():
    """Add and / or remove tags on several items. Body: {ids, add: [tag ids], remove: [tag ids]}.
    ---
    tags:
      - Elements
    responses:
        200: {description: "{updated: n}"}
    """
    return _links('tags')


@bp.route('/bulk-sources', methods=['POST'])
@login_required
def bulk_sources():
    """Add and / or remove sources on several items. Body: {ids, add: [source ids], remove: [source ids]}.
    ---
    tags:
      - Elements
    responses:
        200: {description: "{updated: n}"}
    """
    return _links('sources')


@bp.route('/bulk-move', methods=['POST'])
@login_required
def bulk_move():
    """Move several items to another lesson of the same language.
    ---
    tags:
      - Elements
    responses:
        200: {description: "{moved: n, skipped: []}"}
        400: {description: Invalid ids, same lesson, or another language}
        403: {description: Not the owner}
    """
    body = request.get_json(silent=True) or {}
    ids, target = _ids(body), body.get('target_lesson_id')
    if ids is None or not isinstance(target, str):
        return jsonify({'error': 'ids and target_lesson_id are required'}), 400
    for i in [*ids, target]:
        require_owns(i)
    return _run(lambda: service.move(ids, target, user_id=current_user_id()))
