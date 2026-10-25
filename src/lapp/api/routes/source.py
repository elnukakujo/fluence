from flask import Blueprint, request, jsonify
from lapp.schemas.system_data.source import SourceDict
from pydantic import ValidationError

from ...services import SourceService
from ...schemas.system_data import SourceDict
from ...core.auth import login_required, require_owns, current_user_id

bp = Blueprint('source', __name__, url_prefix='/api/sources')
source_service = SourceService()

@bp.route('/user/<user_id>', methods=['GET'])
@login_required
def get_by_user(user_id: str):
    """Get all sources.
    ---
    tags:
        - Sources
    parameters:
        - name: user_id
          in: path
          type: string
          required: true
          description: The ID of the user to retrieve sources for
    responses:
        200:
            description: List of sources
            schema:
                type: array
                items:
                    type: object
                    description: Source object
    """
    sources = source_service.get_by_user_id(user_id=current_user_id(), as_dict=True)
    if sources is None or len(sources) == 0:
        return jsonify([]), 200
    return jsonify(sources), 200

@bp.route('/<source_id>', methods=['GET'])
@login_required
def get_by_id(source_id: str):
    """Get a specific source by ID.
    ---
    tags:
        - Sources
    parameters:
        - name: source_id
          in: path
          type: string
          required: true
          description: The ID of the source to retrieve
    responses:
        200:
            description: Source object
            schema:
                type: object
        404:
            description: Source not found
    """
    require_owns(source_id)
    source = source_service.get_by_id(source_id, as_dict=True)

    if not source:
        return jsonify({'error': 'Source not found'}), 404
    
    return jsonify(source), 200


@bp.route('/', methods=['POST'])
@login_required
def create_source():
    """Create a new source.
    ---
    tags:
      - Sources
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
                    description: The ID of the user the source belongs to
                    example: "user_U0"
                title:
                    type: string
                    required: true
                    description: The title of the source
                    example: "My Language Learning Journey"
                date:
                    type: string
                    required: false
                    description: The date associated with the source (e.g., when it was created or published)
                    example: "2024-01-01"
                description:
                    type: string
                    required: false
                    description: A brief description of the source
                    example: "This source contains my notes and materials for learning the language."
                source_type:
                    type: string
                    required: false
                    description: The type of the source (e.g., original, textbook, class, online, media, social, other, ai)
                    example: "original"
    responses:
        201:
            description: Source created successfully
            schema:
                type: object
                properties:
                    success:
                        type: boolean
                    source:
                        type: object
                        description: The created source object
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
        data = SourceDict(**request.json)
        data.user_id = current_user_id()

        # Create source
        source = source_service.create(data, as_dict=True)
        
        if source:
            return jsonify({
                'success': True,
                'source': source
            }), 201
        else:
            return jsonify({'error': 'Failed to create source'}), 400
            
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': e.errors()}), 400


@bp.route('/<source_id>', methods=['PUT', 'PATCH'])
@login_required
def update_source(source_id: str):
    """Update a source.
    ---
    tags:
      - Sources
    parameters:
      - name: source_id
        in: path
        type: string
        required: true
        description: The ID of the source to update
      - name: body
        in: body
        required: true
        schema:
            type: object
            properties:
                user_id:
                    type: string
                    description: The ID of the user the source belongs to
                    required: true
                    example: "user_U0"
                id:
                    type: string
                    description: The ID of the source (must match the source_id in the path)
                    required: true
                    example: "source_S1"
                title:
                    type: string
                    description: The title of the source
                    required: true
                    example: "My Language Learning Journey"
                date:
                    type: string
                    description: The date associated with the source (e.g., when it was created or published)
                    required: false
                    example: "2024-01-01"
                description:
                    type: string
                    description: A brief description of the source
                    required: false
                    example: "This source contains my notes and materials for learning the language."
                source_type:
                    type: string
                    description: The type of the source (e.g., original, textbook, class, online, media, social, other, ai)
                    required: false
                    example: "original"
    responses:
        200:
            description: Source updated successfully
            schema:
                type: object
                properties:
                    success:
                        type: boolean
                    source:
                        type: object
                        description: The updated source object
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
        require_owns(source_id)
        data = SourceDict(**request.json)

        source = source_service.update(source_id, data, as_dict=True)
        
        if source:
            return jsonify({
                'success': True,
                'source': source
            })
        else:
            return jsonify({'error': 'Source not found'}), 404
            
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': e.errors()}), 400


@bp.route('/<source_id>', methods=['DELETE'])
@login_required
def delete_source(source_id: str):
    """Delete a source.
    ---
    tags:
      - Sources
    parameters:
      - name: source_id
        in: path
        type: string
        required: true
        description: The ID of the source to delete
    responses:
        204:
            description: Source deleted successfully
        404:
            description: Source not found
    """
    require_owns(source_id)
    success = source_service.delete(source_id)
    
    if success:
        return jsonify({'success': True}), 204
    else:
        return jsonify({'error': 'Source not found'}), 404
    
@bp.route('/add_source', methods=['POST'])
@login_required
def add_source_to_element():
    """Add a source to an element (character, word, passage, etc.).
    ---
    tags:
      - Sources
    parameters:
      - name: body
        in: body
        required: true
        schema:
            type: object
            properties:
                source_id:
                    type: string
                    required: true
                    description: The ID of the source to add
                    example: "source_S1"
                element_id:
                    type: string
                    required: true
                    description: The ID of the element to add the source to (e.g., character, word, passage)
                    example: "char_C1"
    responses:
        200:
            description: Source added to element successfully
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
        source_id = data.get('source_id')
        element_id = data.get('element_id')
        
        if not source_id or not element_id:
            return jsonify({'error': 'source_id and element_id are required'}), 400

        require_owns(source_id)
        require_owns(element_id)
        success = source_service.add_source_to_element(source_id, element_id)
        
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'Failed to add source to element'}), 400
            
    except Exception as e:
        return jsonify({'error': 'An error occurred', 'details': str(e)}), 500
    
@bp.route('/remove_source', methods=['POST'])
@login_required
def remove_source_from_element():
    """Remove a source from an element (character, word, passage, etc.).
    ---
    tags:
      - Sources
    parameters:
      - name: body
        in: body
        required: true
        schema:
            type: object
            properties:
                source_id:
                    type: string
                    required: true
                    description: The ID of the source to remove
                    example: "source_S1"
                element_id:
                    type: string
                    required: true
                    description: The ID of the element to remove the source from (e.g., character, word, passage)
                    example: "char_C1"
    responses:
        200:
            description: Source removed from element successfully
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
        source_id = data.get('source_id')
        element_id = data.get('element_id')
        
        if not source_id or not element_id:
            return jsonify({'error': 'source_id and element_id are required'}), 400

        require_owns(source_id)
        require_owns(element_id)
        success = source_service.remove_source_from_element(source_id, element_id)
        
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'Failed to remove source from element'}), 400
            
    except Exception as e:
        return jsonify({'error': 'An error occurred', 'details': str(e)}), 500