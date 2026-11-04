from flask import Blueprint, request, jsonify
from pydantic import ValidationError
import logging
logger = logging.getLogger(__name__)

from ...services import TagService
from ...schemas.system_data import TagDict
from ...core.auth import login_required, require_owns, current_user_id

bp = Blueprint('tag', __name__, url_prefix='/api/tags')
tag_service = TagService()

@bp.route('/user/<user_id>', methods=['GET'])
@login_required
def get_by_user(user_id: str):
    """Get all tags.
    ---
    tags:
        - Tags
    parameters:
        - name: user_id
          in: path
          type: string
          required: true
          description: The ID of the user to retrieve tags for
          example: "user_U0"
    responses:
        200:
            description: List of tags
            schema:
                type: array
                items:
                    type: object
                    description: Tag object
    """
    tags = tag_service.get_by_user_id(user_id=current_user_id(), as_dict=True)
    if tags is None or len(tags) == 0:
        return jsonify([]), 200
    return jsonify(tags), 200

@bp.route('/<tag_id>', methods=['GET'])
@login_required
def get_by_id(tag_id: str):
    """Get a specific tag by ID.
    ---
    tags:
        - Tags
    parameters:
        - name: tag_id
          in: path
          type: string
          required: true
          description: The ID of the tag to retrieve
    responses:
        200:
            description: Tag object
            schema:
                type: object
        404:
            description: Tag not found
    """
    require_owns(tag_id)
    tag = tag_service.get_by_id(tag_id, as_dict=True)

    if not tag:
        return jsonify({'error': 'Tag not found'}), 404
    
    return jsonify(tag), 200


@bp.route('/', methods=['POST'])
@login_required
def create_tag():
    """Create a new tag.
    ---
    tags:
      - Tags
    parameters:
      - name: body
        in: body
        required: true
        schema:
            type: object
            properties:
                user_id:
                    type: string
                    required: true
                    description: The ID of the user the tag belongs to
                    example: "user_U0"
                name:
                    type: string
                    required: true
                    description: The name of the tag
                    example: "Basic Phrases"
                description:
                    type: string
                    required: false
                    description: A brief description of the tag
                    example: "This tag is used for basic phrases in the language."
                color:
                    type: string
                    required: false
                    description: The color associated with the tag in hex format (e.g., #RRGGBB)
                    example: "#FF5733"
    responses:
        201:
            description: Tag created successfully
            schema:
                type: object
                properties:
                    success:
                        type: boolean
                    tag:
                        type: object
                        description: The created tag object
        400:
            description: Validation error
            properties:
                error:
                    type: string
                    description: Error message
                details:
                    type: array
                    description: List of validation errors
    """
    try:
        # Validate request data
        data = TagDict(**request.json)
        data.user_id = current_user_id()

        # Create tag
        tag = tag_service.create(data, as_dict=True)
        
        if tag:
            return jsonify({
                'success': True,
                'tag': tag
            }), 201
        else:
            return jsonify({'error': 'Failed to create tag'}), 400
            
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': e.errors()}), 400


@bp.route('/<tag_id>', methods=['PUT', 'PATCH'])
@login_required
def update_tag(tag_id: str):
    """Update a tag.
    ---
    tags:
      - Tags
    parameters:
      - name: tag_id
        in: path
        type: string
        required: true
        description: The ID of the tag to update
      - name: body
        in: body
        required: true
        schema:
            type: object
            properties:
                user_id:
                    type: string
                    description: The ID of the user the tag belongs to
                    required: true
                    example: "user_U0"
                name:
                    type: string
                    description: The name of the tag
                    required: true
                    example: "Basic Phrases"
                description:
                    type: string
                    description: A brief description of the tag
                    required: false
                    example: "This tag is used for basic phrases in the language."
                color:
                    type: string
                    description: The color associated with the tag in hex format (e.g., #RRGGBB)
                    required: false
                    example: "#FF5733"
    """
    try:
        require_owns(tag_id)
        data = TagDict(**request.json)

        tag = tag_service.update(tag_id, data, as_dict=True)
        
        if tag:
            return jsonify({
                'success': True,
                'tag': tag
            })
        else:
            return jsonify({'error': 'Tag not found'}), 404
            
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': e.errors()}), 400


@bp.route('/<tag_id>', methods=['DELETE'])
@login_required
def delete_tag(tag_id: str):
    """Delete a tag.
    ---
    tags:
      - Tags
    parameters:
      - name: tag_id
        in: path
        type: string
        required: true
        description: The ID of the tag to delete
    responses:
        204:
            description: Tag deleted successfully
        404:
            description: Tag not found
    """
    require_owns(tag_id)
    success = tag_service.delete(tag_id)
    
    if success:
        return jsonify({'success': True}), 204
    else:
        return jsonify({'error': 'Tag not found'}), 404
    
@bp.route('/add_tag', methods=['POST'])
@login_required
def add_tag_to_element():
    """Add a tag to an element (character, word, passage, etc.).
    ---
    tags:
      - Tags
    parameters:
      - name: body
        in: body
        required: true
        schema:
            type: object
            properties:
                tag_id:
                    type: string
                    required: true
                    description: The ID of the tag to add
                    example: "tag_T1"
                element_id:
                    type: string
                    required: true
                    description: The ID of the element to tag (e.g., character, word, passage)
                    example: "char_C1"
    responses:
        200:
            description: Tag added to element successfully
            schema:
                type: object
                properties:
                    success:
                        type: boolean
        400:
            description: Validation error
            properties:
                error:
                    type: string
                    description: Error message
                details:
                    type: array
                    description: List of validation errors
    """
    try:
        data = request.json
        tag_id = data.get('tag_id')
        element_id = data.get('element_id')
        
        if not tag_id or not element_id:
            return jsonify({'error': 'tag_id and element_id are required'}), 400

        require_owns(tag_id)
        require_owns(element_id)
        success = tag_service.add_tag_to_element(tag_id, element_id)
        
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'Failed to add tag to element'}), 400
            
    except Exception as e:
        return jsonify({'error': 'An error occurred', 'details': str(e)}), 500
    
@bp.route('/remove_tag', methods=['POST'])
@login_required
def remove_tag_from_element():
    """Remove a tag from an element (character, word, passage, etc.).
    ---
    tags:
      - Tags
    parameters:
      - name: body
        in: body
        required: true
        schema:
            type: object
            properties:
                tag_id:
                    type: string
                    required: true
                    description: The ID of the tag to remove
                    example: "tag_T1"
                element_id:
                    type: string
                    required: true
                    description: The ID of the element to untag (e.g., character, word, passage)
                    example: "char_C1"
    responses:
        200:
            description: Tag removed from element successfully
            schema:
                type: object
                properties:
                    success:
                        type: boolean
        400:
            description: Validation error
            properties:
                error:
                    type: string
                    description: Error message
                details:
                    type: array
                    description: List of validation errors
    """
    try:
        data = request.json
        tag_id = data.get('tag_id')
        element_id = data.get('element_id')
        
        if not tag_id or not element_id:
            return jsonify({'error': 'tag_id and element_id are required'}), 400

        require_owns(tag_id)
        require_owns(element_id)
        success = tag_service.remove_tag_from_element(tag_id, element_id)
        
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'Failed to remove tag from element'}), 400
            
    except Exception as e:
        return jsonify({'error': 'An error occurred', 'details': str(e)}), 500

@bp.route('/merge', methods=['POST'])
@login_required
def merge_tags():
    """Merge tag `merge_id` into `keep_id`; every element keeps its tag, the other tag is deleted.
    ---
    tags:
      - Tags
    parameters:
      - name: body
        in: body
        required: true
        schema:
            type: object
            properties:
                keep_id: {type: string}
                merge_id: {type: string}
                name: {type: string, description: "optional new name of the survivor"}
                color: {type: string}
                description: {type: string}
    responses:
        200: {description: The merged tag}
        400: {description: Invalid request (same tag, name already used)}
        403: {description: Not the owner of both tags}
        404: {description: A tag was not found}
    """
    from ...services.bulk import merge_labels
    body = request.get_json(silent=True) or {}
    keep_id, merge_id = body.get('keep_id'), body.get('merge_id')
    if not isinstance(keep_id, str) or not isinstance(merge_id, str):
        return jsonify({'error': 'keep_id and merge_id are required'}), 400
    require_owns(keep_id)
    require_owns(merge_id)
    try:
        return jsonify(merge_labels('tag', keep_id, merge_id, {k: body.get(k) for k in ('name', 'color', 'description')}))
    except LookupError:
        return jsonify({'error': 'Tag not found'}), 404
    except ValueError as e:
        return jsonify({'error': str(e)}), 400


@bp.route('/bulk-delete', methods=['POST'])
@login_required
def bulk_delete_tags():
    """Delete several tags at once (all or nothing); the elements keep existing, only the links go.
    ---
    tags:
      - Tags
    parameters:
      - {name: body, in: body, required: true, schema: {type: object, properties: {ids: {type: array, items: {type: string}}}}}
    responses:
        200: {description: "{deleted: n}"}
        400: {description: Empty or invalid ids}
        403: {description: Not the owner of every one (nothing is deleted)}
        404: {description: One was not found}
    """
    from ...services.bulk import delete_labels
    ids = (request.get_json(silent=True) or {}).get('ids')
    if not isinstance(ids, list) or not ids or not all(isinstance(i, str) for i in ids):
        return jsonify({'error': 'ids must be a non-empty list'}), 400
    ids = list(dict.fromkeys(ids))
    for i in ids:
        require_owns(i)
    try:
        return jsonify({'deleted': delete_labels('tag', ids)})
    except LookupError:
        return jsonify({'error': 'Not found'}), 404


@bp.route('/reorder', methods=['POST'])
@login_required
def reorder_tags():
    """Set the order of the current user's tags.
    ---
    tags:
      - Tags
    parameters:
      - {name: body, in: body, required: true, schema: {type: object, properties: {ids: {type: array, items: {type: string}, description: "every tag id the user owns, in the new order"}}}}
    responses:
        200: {description: Order saved}
        400: {description: ids are not exactly the user's tags}
    """
    from ...services.bulk import reorder_labels
    ids = (request.get_json(silent=True) or {}).get('ids')
    if not isinstance(ids, list) or not reorder_labels('tag', current_user_id(), ids):
        return jsonify({'error': "ids must be exactly your tags, once each"}), 400
    return jsonify({'success': True})

