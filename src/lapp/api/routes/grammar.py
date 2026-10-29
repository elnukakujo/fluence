from flask import Blueprint, request, jsonify
from pydantic import ValidationError

from ...services import GrammarService
from ...schemas import GrammarDict
from ...core.auth import login_required, require_owns, require_write, current_user_id

bp = Blueprint('grammar', __name__, url_prefix='/api/grammar')
grammar_service = GrammarService()

@bp.route('/language/<language_id>', methods=['GET'])
@login_required
def get_all_grammar_from_language(language_id: str):
    """Get all grammar for a specific language.
    --- 
    tags:
        - Grammar
    parameters:
        - name: language_id
          in: path
          type: string
          required: true
          description: The ID of the language to retrieve grammar for
          example: "lang_L1"
    responses:
        200:
            description: A list of grammar items
            schema:
                type: array
                items:
                    type: object
                    description: "A Grammar object"
    """
    require_write(language_id)
    grammar = grammar_service.get_all(language_id=language_id, as_dict=True)
    return jsonify(grammar)


@bp.route('/lesson/<lesson_id>', methods=['GET'])
@login_required
def get_all_grammar_from_lesson(lesson_id: str):
    """Get all grammar for a specific lesson.
    --- 
    tags:
        - Grammar
    parameters:
        - name: lesson_id
          in: path
          type: string
          required: true
          description: The ID of the lesson to retrieve grammar for
          example: "lesson_L1"
    responses:
        200:
            description: A list of grammar items
            schema:
                type: array
                items:
                    type: object
                    description: "A Grammar object"
    """
    require_write(lesson_id)
    grammar = grammar_service.get_all(lesson_id=lesson_id, as_dict=True)
    return jsonify(grammar)


@bp.route('/<grammar_id>', methods=['GET'])
@login_required
def get_grammar(grammar_id: str):
    """Get a specific grammar by ID.
    ---
    tags:
        - Grammar
    parameters:
        - name: grammar_id
          in: path
          type: string
          required: true
          description: The ID of the grammar to retrieve
          example: "gram_G1"
    responses:
        200:
            description: A Grammar object
            schema:
                type: object
        404:
            description: Grammar not found
    """
    require_write(grammar_id)
    grammar = grammar_service.get_by_id(grammar_id, as_dict=True)

    if not grammar:
        return jsonify({'error': 'grammar not found'}), 404
    
    return jsonify(grammar), 200


@bp.route('/', methods=['POST'])
@login_required
def create_grammar():
    """Create a new grammar.
    ---
    tags:
        - Grammar
    parameters:
        - name: body
          in: body
          required: true
          schema:
            type: object
            description: Grammar data
            properties:
                lesson_id:
                    type: string
                    example: "lesson_L1"
                    required: true
                    description: "The ID of the lesson the grammar belongs to"
                title:
                    type: string
                    example: "Past Tense"
                    required: true
                    description: "Title of the grammar"
                explanation:
                    type: string
                    example: "The past tense is used to describe actions that have already happened."
                    required: true
                    description: "Explanation of the grammar"
                example_sentences:
                    type: array
                    required: false
                    description: "Array of passages that illustrate the grammar point"
                    items:
                        type: object
                        properties:
                            text:
                                type: string
                                example: "I walked to the store yesterday."
                                required: true
                                description: "The sentence text"
                            translation:
                                type: string
                                example: "J'ai marché au magasin hier."
                                required: true
                                description: "Translation of the sentence"
                            image_files:
                                type: array
                                items:
                                    type: string
                                    example: "/path/to/image1.jpg"
                                required: false
                            audio_files:
                                type: array
                                items:
                                    type: string
                                    example: "/path/to/audio1.mp3"
                                required: false
                image_files:
                    type: array
                    items:
                        type: string
                        example: "/path/to/image1.jpg"
                        required: false
                        description: List of image file paths
                audio_files:
                    type: array
                    items:
                        type: string
                        example: "/path/to/audio1.mp3"
                        required: false
                        description: List of audio file paths
    responses:
        201:
            description: Grammar created successfully
            schema:
                type: object
        400:
            description: Validation error or failed to create grammar
    """
    try:
        # Validate request data
        data = GrammarDict(**request.json)
        require_write(data.lesson_id)

        # Create grammar
        grammar = grammar_service.create(data, as_dict=True)
        
        if grammar:
            return jsonify({
                'success': True,
                'grammar': grammar
            }), 201
        else:
            return jsonify({'error': 'Failed to create grammar'}), 400
            
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': e.errors()}), 400


@bp.route('/<grammar_id>', methods=['PUT', 'PATCH'])
@login_required
def update_grammar(grammar_id: str):
    """Update a grammar.
    ---
    tags:
        - Grammar
    parameters:
        - name: grammar_id
          in: path
          type: string
          required: true
          description: The ID of the grammar to update
          example: "gram_G1"
        - name: body
          in: body
          required: true
          schema:
            type: object
            description: Grammar data
            properties:
                lesson_id:
                    type: string
                    example: "lesson_L1"
                    required: false
                    description: "The ID of the lesson the grammar belongs to"
                title:
                    type: string
                    example: "Past Tense"
                    required: false
                    description: "Title of the grammar"
                explanation:
                    type: string
                    example: "The past tense is used to describe actions that have already happened."
                    required: false
                    description: "Explanation of the grammar"
                example_sentences:
                    type: array
                    required: false
                    description: "Array of passages that illustrate the grammar point"
                    items:
                        type: object
                        properties:
                            text:
                                type: string
                                example: "I walked to the store yesterday."
                                required: true
                                description: "The sentence text"
                            translation:
                                type: string
                                example: "J'ai marché au magasin hier."
                                required: true
                                description: "Translation of the sentence"
                            image_files:
                                type: array
                                items:
                                    type: string
                                    example: "/path/to/image1.jpg"
                                required: false
                            audio_files:
                                type: array
                                items:
                                    type: string
                                    example: "/path/to/audio1.mp3"
                                required: false
                image_files:
                    type: array
                    items:
                        type: string
                        example: "/path/to/image1.jpg"
                        required: false
                        description: List of image file paths
                audio_files:
                    type: array
                    items:
                        type: string
                        example: "/path/to/audio1.mp3"
                        required: false
                        description: List of audio file paths
    responses:
        201:
            description: Grammar created successfully
            schema:
                type: object
        404:
            description: grammar not found
        400:
            description: Validation error
    """
    try:
        require_write(grammar_id)
        data = GrammarDict(**request.json)

        grammar = grammar_service.update(grammar_id, data, as_dict=True)
        
        if grammar:
            return jsonify({
                'success': True,
                'grammar': grammar
            })
        else:
            return jsonify({'error': 'grammar not found'}), 404
            
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': e.errors()}), 400


@bp.route('/<grammar_id>', methods=['DELETE'])
@login_required
def delete_grammar(grammar_id: str):
    """Delete a grammar.
    ---
    tags:
        - Grammar
    parameters:
        - name: grammar_id
          in: path
          type: string
          required: true
          description: The ID of the grammar to delete
          example: "gram_G1"
    responses:
        204:
            description: Grammar deleted successfully
        404:
            description: grammar not found
    """
    require_write(grammar_id)
    success = grammar_service.delete(grammar_id)
    
    if success:
        return jsonify({'success': True}), 204
    else:
        return jsonify({'error': 'grammar not found'}), 404
    
@bp.route('/score', methods=['POST'])
@login_required
def score_grammar():
    """Score a grammar.
    ---
    tags:
        - Grammar
    parameters:
        - name: body
          in: body
          required: true
          schema:
            type: object
            description: Score data
            properties:
                grammar_id:
                    type: string
                    example: "gram_G1"
                    required: true
                    description: "The ID of the grammar to score"
                score:
                    type: number
                    example: 0.8
                    required: true
                    description: "The score for the grammar"
    responses:
        200:
            description: Grammar scored successfully
    """
    data = request.json
    grammar_id = data['grammar_id']
    require_write(grammar_id)
    score = float(data['score'])
    duration_ms = float(data['duration_ms'])
    hint_used = bool(data.get('hint_used', False))

    grammar = grammar_service.update_score(
        grammar_id,
        score,
        duration_ms=duration_ms,
        hint_used=hint_used,
        user_id=current_user_id(),
    )

    if grammar:
        return jsonify({'success': True})
    else:
        return jsonify({'error': 'grammar not found'}), 404