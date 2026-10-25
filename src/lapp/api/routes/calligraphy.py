from flask import Blueprint, request, jsonify
from pydantic import ValidationError

from ...services import CalligraphyService
from ...schemas import CalligraphyDict
from ...core.exceptions import DuplicateEntityError
from ...core.auth import login_required, require_owns

bp = Blueprint('calligraphy', __name__, url_prefix='/api/calligraphy')
calligraphy_service = CalligraphyService()

@bp.route('/language/<language_id>', methods=['GET'])
@login_required
def get_all_calligraphy_from_language(language_id: str):
    """Get all calligraphy for a specific language.
    ---
    tags:
        - Calligraphy
    parameters:
        - name: language_id
          in: path
          type: string
          required: true
          description: The ID of the language to retrieve calligraphy from
          example: "lang_L1"
    responses:
        200:
            description: List of calligraphy
            schema:
                type: array
                items:
                    type: object
                    description: calligraphy object
    """
    require_owns(language_id)
    calligraphy = calligraphy_service.get_all(language_id=language_id, as_dict=True)
    return jsonify(calligraphy)


@bp.route('/lesson/<lesson_id>', methods=['GET'])
@login_required
def get_all_calligraphy_from_lesson(lesson_id: str):
    """Get all calligraphy for a specific lesson.
    ---
    tags:
        - Calligraphy
    parameters:
        - name: lesson_id
          in: path
          type: string
          required: true
          description: The ID of the lesson to retrieve calligraphy from
          example: "lesson_L1"
    responses:
        200:
            description: List of calligraphy
            schema:
                type: array
                items:
                    type: object
                    description: calligraphy object    
    """
    require_owns(lesson_id)
    calligraphy = calligraphy_service.get_all(lesson_id=lesson_id, as_dict=True)
    return jsonify(calligraphy)


@bp.route('/<calligraphy_id>', methods=['GET'])
@login_required
def get_calligraphy(calligraphy_id: str):
    """Get a specific calligraphy by ID.
    ---
    tags:
        - Calligraphy
    parameters:
        - name: calligraphy_id
          in: path
          type: string
          required: true
          description: The ID of the calligraphy to retrieve
          example: "call_C1"
    responses:
        200:
            description: calligraphy object
            schema:
                type: object
                description: calligraphy object
    """
    require_owns(calligraphy_id)
    calligraphy = calligraphy_service.get_by_id(calligraphy_id, as_dict=True)

    if not calligraphy:
        return jsonify({'error': 'calligraphy not found'}), 404
    
    return jsonify(calligraphy)


@bp.route('/', methods=['POST'])
@login_required
def create_calligraphy():
    """Create a new calligraphy.
    ---
    tags:
        - Calligraphy
    parameters:
        - name: body
          in: body
          required: true
          description: The calligraphy to create
          schema:
              type: object
              properties:
                  lesson_id:
                      type: string
                      example: "lesson_L1"
                      description: The ID of the lesson the calligraphy belongs to
                      required: true
                  character:
                      type: object
                      required: true
                      description: Character information
                      properties:
                          character:
                              type: string
                              example: "漢"
                              required: true
                              description: The character itself
                          phonetic:
                              type: string
                              example: "hàn"
                              required: true
                              description: The phonetic representation
                          meaning:
                              type: string
                              example: "Chinese"
                              required: false
                              description: The meaning of the character
                          radical:
                              type: string
                              example: "氵"
                              required: false
                              description: The radical of the character
                          strokes:
                              type: integer
                              example: 15
                              required: false
                              description: Number of strokes
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
                  example_words:
                      type: array
                      items:
                          type: object
                          required: false
                          description: Example word using the character
                          properties:
                              word:
                              type: string
                              example: "漢字"
                              required: true
                              description: The word text
                          phonetic:
                              type: string
                              example: "hànzì"
                              required: true
                              description: The phonetic representation
                          translation:
                              type: string
                              example: "Chinese characters"
                              required: true
                              description: Translation of the word
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
                        description: List of image file paths for the calligraphy item
                  audio_files:
                      type: array
                      items:
                        type: string
                        example: "/path/to/audio1.mp3"
                        required: false
                        description: List of audio file paths for the calligraphy item
    Pass "on_conflict" in the body ("keep" | "overwrite" | "merge") to resolve
    a character that already exists for this language. Omit it to have the
    server respond 409 with the existing/incoming/diff instead of guessing.
    responses:
        201:
            description: calligraphy created successfully
            schema:
                type: object
                description: The created calligraphy object
        400:
            description: calligraphy creation failed
        409:
            description: A character already exists for the language; resolve with on_conflict
    """
    try:
        # Validate request data
        on_conflict = request.json.pop('on_conflict', None) if request.json else None
        data = CalligraphyDict(**request.json)
        require_owns(data.lesson_id)

        # Create calligraphy
        calligraphy = calligraphy_service.create(data, as_dict=True, on_conflict=on_conflict)

        if calligraphy:
            return jsonify({
                'success': True,
                    'calligraphy': calligraphy
            }), 201
        else:
            return jsonify({'error': 'Failed to create calligraphy'}), 400

    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': e.errors()}), 400
    except DuplicateEntityError as e:
        return jsonify({
            'conflict': True,
            'entity_type': e.entity_type,
            'existing': e.existing,
            'incoming': e.incoming,
            'diff': e.diff,
        }), 409


@bp.route('/<calligraphy_id>', methods=['PUT', 'PATCH'])
@login_required
def update_calligraphy(calligraphy_id: str):
    """Update a calligraphy.
    ---
    tags:
        - Calligraphy
    parameters:
        - name: calligraphy_id
          in: path
          type: string
          required: true
          description: The ID of the calligraphy to update
          example: "call_C1"
        - name: body
          in: body
          required: true
          schema:
              type: object
              properties:
                  lesson_id:
                      type: string
                      example: "lesson_L1"
                      required: false
                      description: The ID of the lesson the calligraphy belongs to
                  character:
                      type: object
                      required: false
                      description: Character information
                      properties:
                          character:
                              type: string
                              example: "漢"
                              required: false
                              description: The character itself
                          phonetic:
                              type: string
                              example: "hàn"
                              required: false
                              description: The phonetic representation
                          meaning:
                              type: string
                              example: "Chinese"
                              required: false
                              description: The meaning of the character
                          radical:
                              type: string
                              example: "氵"
                              required: false
                              description: The radical of the character
                          strokes:
                              type: integer
                              example: 15
                              required: false
                              description: Number of strokes
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
                  example_words:
                      type: array
                      items:
                          type: object
                          required: false
                          description: Example word using the character
                          properties:
                              word:
                              type: string
                              example: "漢字"
                              required: false
                              description: The word text
                          phonetic:
                              type: string
                              example: "hànzì"
                              required: false
                              description: The phonetic representation
                          translation:
                              type: string
                              example: "Chinese characters"
                              required: false
                              description: Translation of the word
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
            description: calligraphy updated successfully
            schema:
                type: object
                description: The updated calligraphy object
        400:
            description: calligraphy update failed
    """
    try:
        require_owns(calligraphy_id)
        data = CalligraphyDict(**request.json)

        calligraphy = calligraphy_service.update(calligraphy_id, data, as_dict=True)
        
        if calligraphy:
            return jsonify({
                'success': True,
                    'calligraphy': calligraphy
            }), 201
        else:
            return jsonify({'error': 'calligraphy not found'}), 404
            
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': e.errors()}), 400


@bp.route('/<calligraphy_id>', methods=['DELETE'])
@login_required
def delete_calligraphy(calligraphy_id: str):
    """Delete a calligraphy.
    ---
    tags:
        - Calligraphy
    parameters:
        - name: calligraphy_id
          in: path
          type: string
          required: true
          description: The ID of the calligraphy to delete
          example: "call_C1"
    responses:
        204:
            description: calligraphy deleted successfully
        404:
            description: calligraphy not found
    """
    require_owns(calligraphy_id)
    success = calligraphy_service.delete(calligraphy_id)
    
    if success:
        return jsonify({'success': True}), 204
    else:
        return jsonify({'error': 'calligraphy not found'}), 404
    
@bp.route('/score', methods=['POST'])
@login_required
def score_calligraphy():
    """Score a calligraphy.
    ---
    tags:
        - Calligraphy
    parameters:
        - name: body
          in: body
          required: true
          schema:
              type: object
              properties:
                  calligraphy_id:
                      type: string
                      example: "call_C1"
                      description: The ID of the calligraphy to score
                      required: true
                  score:
                      type: number
                      example: 0.8
                      description: The score for the calligraphy
                      required: true
    responses:
        200:
            description: calligraphy scored successfully
            schema:
                type: object
                description: The scored calligraphy object
        404:
            description: calligraphy not found
    """
    data = request.json
    calligraphy_id = data['calligraphy_id']
    require_owns(calligraphy_id)
    score = float(data['score'])
    duration_ms = float(data['duration_ms'])
    hint_used = bool(data.get('hint_used', False))

    calligraphy = calligraphy_service.update_score(
        calligraphy_id,
        score,
        duration_ms=duration_ms,
        hint_used=hint_used,
        as_dict=True,
        include_relations=False,
    )
    
    if calligraphy:
        return jsonify({
            'success': True,
                'calligraphy': calligraphy
        })
    else:
        return jsonify({'error': 'calligraphy not found'}), 404