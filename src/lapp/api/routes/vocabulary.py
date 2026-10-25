from flask import Blueprint, request, jsonify
from pydantic import ValidationError
import logging
logger = logging.getLogger(__name__)

from ...services import VocabularyService
from ...schemas.features import VocabularyDict
from ...core.exceptions import DuplicateEntityError
from ...core.auth import login_required, require_owns

bp = Blueprint('vocabulary', __name__, url_prefix='/api/vocabulary')
vocabulary_service = VocabularyService()


@bp.route('/language/<language_id>', methods=['GET'])
@login_required
def get_all_vocabulary_from_language(language_id: str):
    """Get all vocabulary for a specific language.
    ---
    tags:
        - Vocabulary
    parameters:
        - name: language_id
          in: path
          type: string
          required: true
          description: The ID of the language to retrieve vocabulary from
          example: "lang_L1"
    responses:
        200:
            description: List of vocabulary
            schema:
                type: array
                items:
                    type: object
                    description: Vocabulary object
    """
    require_owns(language_id)
    vocabulary = vocabulary_service.get_all(language_id=language_id, as_dict=True)
    return jsonify(vocabulary)

@bp.route('/lesson/<lesson_id>', methods=['GET'])
@login_required
def get_all_vocabulary_from_lesson(lesson_id: str):
    """Get all vocabulary for a specific lesson.
    ---
    tags:
        - Vocabulary
    parameters:
        - name: lesson_id
          in: path
          type: string
          required: true
          description: The ID of the lesson to retrieve vocabulary from
          example: "lesson_L1"
    responses:
        200:
            description: List of vocabulary
            schema:
                type: array
                items:
                    type: object
                    description: Vocabulary object
    """
    require_owns(lesson_id)
    vocabulary = vocabulary_service.get_all(lesson_id=lesson_id, as_dict=True)
    return jsonify(vocabulary)


@bp.route('/<vocabulary_id>', methods=['GET'])
@login_required
def get_vocabulary(vocabulary_id: str):
    """Get a specific vocabulary by ID.
    ---
    tags:
        - Vocabulary
    parameters:
        - name: vocabulary_id
          in: path
          type: string
          required: true
          description: The ID of the vocabulary to retrieve
    responses:
        200:
            description: Vocabulary object
            schema:
                type: object
        404:
            description: Vocabulary not found
    """
    require_owns(vocabulary_id)
    vocabulary = vocabulary_service.get_by_id(vocabulary_id, as_dict=True)

    if not vocabulary:
        return jsonify({'error': 'Vocabulary not found'}), 404
    
    return jsonify(vocabulary)


@bp.route('/', methods=['POST'])
@login_required
def create_vocabulary():
    """Create a new vocabulary.
    ---
    tags:
        - Vocabulary
    parameters:
        - name: body
          in: body
          required: true
          schema:
              type: object
              properties:
                  lesson_id:
                      type: string
                      example: "lesson_L1"
                      required: true
                  word:
                      type: object
                      properties:
                          word:
                              type: string
                              example: "Bonjour"
                              required: true
                          translation:
                              type: string
                              example: "Hello"
                              required: true
                          phonetic:
                              type: string
                              example: "bɔ̃ʒuʁ"
                              required: false
                          type:
                              type: string
                              example: "interjection"
                              required: true
                          gender:
                              type: string
                              example: "m"
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
                  example_sentences:
                      type: array
                      items:
                          type: object
                          properties:
                              text:
                                  type: string
                                  example: "Bonjour! Comment ça va?"
                                  required: true
                              translation:
                                  type: string
                                  example: "Hello! How are you?"
                                  required: true
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
    Pass "on_conflict" in the body ("keep" | "overwrite" | "merge") to resolve
    a word that already exists for this language. Omit it to have the server
    respond 409 with the existing/incoming/diff instead of guessing.
    responses:
        201:
            description: Vocabulary created successfully
            schema:
                type: object
        400:
            description: Validation error
        409:
            description: A word with this text already exists for the language; resolve with on_conflict
    """
    try:
        # Validate request data
        logger.debug(f"Received request data for creating vocabulary: {request.json}")
        on_conflict = request.json.pop('on_conflict', None) if request.json else None
        data = VocabularyDict(**request.json)
        require_owns(data.lesson_id)
        logger.debug(f"Validated data for creating vocabulary: {data}")

        # Create vocabulary
        vocabulary = vocabulary_service.create(data, as_dict=True, on_conflict=on_conflict)

        if vocabulary:
            return jsonify({
                'success': True,
                'vocabulary': vocabulary
            }), 201
        else:
            return jsonify({'error': 'Failed to create vocabulary'}), 400

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


@bp.route('/<vocabulary_id>', methods=['PUT', 'PATCH'])
@login_required
def update_vocabulary(vocabulary_id: str):
    """Update a vocabulary.
    ---
    tags:
        - Vocabulary
    parameters:
        - name: vocabulary_id
          in: path
          type: string
          required: true
          description: The ID of the vocabulary to update
        - name: body
          in: body
          required: true
          schema:
              type: object
              properties:
                  lesson_id:
                      type: string
                      example: "lesson_L1"
                      required: true
                  word:
                      type: object
                      properties:
                          word:
                              type: string
                              example: "Bonjour"
                              required: true
                          translation:
                              type: string
                              example: "Hello"
                              required: true
                          phonetic:
                              type: string
                              example: "bɔ̃ʒuʁ"
                              required: false
                          type:
                              type: string
                              example: "interjection"
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
                  example_sentences:
                      type: array
                      items:
                          type: object
                          properties:
                              text:
                                  type: string
                                  example: "Bonjour! Comment ça va?"
                                  required: true
                              translation:
                                  type: string
                                  example: "Hello! How are you?"
                                  required: true
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
        200:
            description: Vocabulary updated successfully
            schema:
                type: object
        400:
            description: Validation error
        404:
            description: Vocabulary not found
    """
    try:
        require_owns(vocabulary_id)
        data = VocabularyDict(**(request.get_json() or {}))

        vocabulary = vocabulary_service.update(
            vocabulary_id,
            data,
            as_dict=True,
        )
        
        if vocabulary:
            return jsonify({
                'success': True,
                'vocabulary': vocabulary
            })
        else:
            return jsonify({'error': 'Vocabulary not found'}), 404
            
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': e.errors()}), 400


@bp.route('/<vocabulary_id>', methods=['DELETE'])
@login_required
def delete_vocabulary(vocabulary_id: str):
    """Delete a vocabulary.
    ---
    tags:
        - Vocabulary
    parameters:
        - name: vocabulary_id
          in: path
          type: string
          required: true
          description: The ID of the vocabulary to delete
    responses:
        204:
            description: Vocabulary deleted successfully
        404:
            description: Vocabulary not found    
    """
    require_owns(vocabulary_id)
    success = vocabulary_service.delete(vocabulary_id)
    
    if success:
        return jsonify({'success': True}), 204
    else:
        return jsonify({'error': 'Vocabulary not found'}), 404
    
@bp.route('/score/', methods=['POST'])
@login_required
def score_vocabulary():
    """Score a vocabulary.
    ---
    tags:
        - Vocabulary
    parameters:
        - name: body
          in: body
          required: true
          schema:
              type: object
              properties:
                  vocabulary_id:
                      type: string
                      example: "voc_V1"
                      required: true
                      description: The ID of the vocabulary to score
                  score:
                      type: number
                      example: 0.8
                      required: true
                      description: The score for the vocabulary
    responses:
        200:
            description: Vocabulary scored successfully
            schema:
                type: object
        404:
            description: Vocabulary not found
    """
    data = request.json
    vocabulary_id = data['vocabulary_id']
    require_owns(vocabulary_id)
    score = float(data['score'])
    duration_ms = float(data['duration_ms'])
    hint_used = bool(data.get('hint_used', False))

    vocabulary = vocabulary_service.update_score(
        vocabulary_id,
        score,
        duration_ms=duration_ms,
        hint_used=hint_used,
        as_dict=True,
        include_relations=False,
    )
    
    if vocabulary:
        return jsonify({
            'success': True,
            'vocabulary': vocabulary
        })
    else:
        return jsonify({'error': 'Vocabulary not found'}), 404