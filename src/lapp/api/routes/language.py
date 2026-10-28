from flask import Blueprint, request, jsonify
from pydantic import ValidationError
import logging
logger = logging.getLogger(__name__)

from ...services import LanguageService
from ...schemas.containers import LanguageDict
from ...core.auth import login_required, require_owns, require_write, current_user_id

bp = Blueprint('language', __name__, url_prefix='/api/languages')
language_service = LanguageService()

@bp.route('/all/<user_id>', methods=['GET'])
@login_required
def get_all_user_languages(user_id: str):
    """
    Get all languages for the current user
    ---
    tags:
      - Languages
    responses:
      200:
        description: List of languages
        schema:
          type: array
          items:
            type: object
    """
    languages = language_service.get_by_user_id(user_id=current_user_id(), as_dict=True)
    if languages is None or len(languages) == 0:
        return jsonify([]), 200
    return jsonify(languages)


@bp.route('/<language_id>', methods=['GET'])
@login_required
def get_language(language_id: str):
    """
    Get a specific language by ID
    ---
    tags:
      - Languages
    parameters:
      - name: language_id
        in: path
        type: string
        required: true
        description: The ID of the language to retrieve
    responses:
      200:
        description: Language object
        schema:
          type: object
      404:
        description: Language not found
    """
    require_write(language_id)
    language = language_service.get_by_id(language_id, as_dict=True)

    if not language:
        return jsonify({'error': 'Language not found'}), 404
    
    return jsonify(language)


@bp.route('/', methods=['POST'])
@login_required
def create_language():
    """Create a new language.
    ---
    tags:
      - Languages
    parameters:
      - name: body
        in: body
        required: true
        schema:
            type: object
            properties:
                name:
                    type: string
                    example: "French"
                alias:
                    type: string
                    example: "Français"
                level:
                    type: number
                    example: 0
                    required: false
                description:
                    type: string
                    example: "A Romance language spoken in France."
                    required: false
                flag:
                    type: string
                    example: "🇫🇷"
                    required: false
                user_id:
                    type: string
                    example: "user_U0"
                    required: true
                target_iso639_2t:
                    type: string
                    example: "fra"
                    required: false
                source_iso639_2t:
                    type: string
                    example: "eng"
                    required: false
    responses:
      201:
        description: Language created successfully
        schema:
          type: object
      400:
        description: Validation failed or creation error
    """
    try:
        # Validate request data
        data = LanguageDict(**request.json)
        data.user_id = current_user_id()

        # Create language
        language = language_service.create(data, as_dict=True)
        
        if language:
            return jsonify({
                'success': True,
                'language': language
            }), 201
        else:
            return jsonify({'error': 'Failed to create language'}), 400
            
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': e.errors()}), 400


@bp.route('/<language_id>', methods=['PUT', 'PATCH'])
@login_required
def update_language(language_id: str):
    """Update a language.
    ---
    tags:
      - Languages
    parameters:
      - name: language_id
        in: path
        type: string
        required: true
        description: The ID of the language to update
      - name: body
        in: body
        required: true
        schema:
            type: object
            properties:
                name:
                    type: string
                    example: "French"
                alias:
                    type: string
                    example: "Français"
                level:
                    type: number
                    example: 0
                    required: false
                description:
                    type: string
                    example: "A Romance language spoken in France."
                    required: false
                flag:
                    type: string
                    example: "🇫🇷"
                    required: false
                current_lesson_id:
                    type: string
                    example: "lesson_L1"
                    required: false
    responses:
      200:
        description: Language updated successfully
        schema:
          type: object
          schema:
            type: object
            properties:
                success:
                    type: boolean
                    example: true
                    description: Indicates if the update was successful
                language:
                    type: object
                    description: The updated language object
      400:
        description: Validation failed
      404:
        description: Language not found
    """
    try:
        require_write(language_id)
        data = LanguageDict(**request.json)

        language = language_service.update(language_id, data, as_dict=True)
        
        if language:
            return jsonify({
                'success': True,
                'language': language
            })
        else:
            return jsonify({'error': 'Language not found'}), 404
            
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': e.errors()}), 400


@bp.route('/<language_id>', methods=['DELETE'])
@login_required
def delete_language(language_id: str):
    """Delete a language.
    ---
    tags:
      - Languages
    parameters:
      - name: language_id
        in: path
        type: string
        required: true
        description: The ID of the language to delete
    responses:
        204:
            description: Language deleted successfully
        404:
            description: Language not found
    """
    require_owns(language_id)
    success = language_service.delete(language_id)

    if success:
        return jsonify({'success': True}), 204
    else:
        return jsonify({'error': 'Language not found'}), 404