from flask import Blueprint, request, jsonify
from pydantic import ValidationError

from ...services import ExerciseService
from ...services.system_data import CollaborationProgressService
from ...schemas import ExerciseDict
from ...core.auth import login_required, require_owns, require_write, owner_user_id, current_user_id

bp = Blueprint('exercise', __name__, url_prefix='/api/exercise')
exercise_service = ExerciseService()

@bp.route('/language/<language_id>', methods=['GET'])
@login_required
def get_all_exercise_from_language(language_id: str):
    """Get all exercise for a specific language.
    ---
    tags:
        - Exercise
    parameters:
        - name: language_id
          in: path
          type: string
          required: true
          description: The ID of the language to retrieve exercise from
          example: "lang_L1"
    responses:
        200:
            description: List of exercise
            schema:
                type: array
                items:
                    type: object
                    description: Exercise object
    """
    require_write(language_id)
    exercise = exercise_service.get_all(language_id=language_id, as_dict=True)
    return jsonify(exercise)


@bp.route('/lesson/<lesson_id>', methods=['GET'])
@login_required
def get_all_exercise_from_lesson(lesson_id: str):
    """Get all exercise for a specific lesson.
    ---
    tags:
        - Exercise
    parameters:
        - name: lesson_id
          in: path
          type: string
          required: true
          description: The ID of the lesson to retrieve exercise from
          example: "lesson_L1"
    responses:
        200:
            description: List of exercise
            schema:
                type: array
                items:
                    type: object
                    description: Exercise object
    """
    require_write(lesson_id)
    exercise = exercise_service.get_all(lesson_id=lesson_id, as_dict=True)
    return jsonify(exercise)


@bp.route('/<exercise_id>', methods=['GET'])
@login_required
def get_exercise(exercise_id: str):
    """Get a specific exercise by ID.
    ---
    tags:
        - Exercise
    parameters:
        - name: exercise_id
          in: path
          type: string
          required: true
          description: The ID of the exercise to retrieve
          example: "ex_E1"
    responses:
        200:
            description: Exercise object
            schema:
                type: object
                description: Exercise object
        404:
            description: Exercise not found
    """
    require_write(exercise_id)
    exercise = exercise_service.get_by_id(exercise_id, as_dict=True)

    if not exercise:
        return jsonify({'error': 'exercise not found'}), 404
    
    return jsonify(exercise)


@bp.route('/', methods=['POST'])
@login_required
def create_exercise():
    """Create a new exercise.
    ---
    tags:
        - Exercise
    parameters:
        - name: body
          in: body
          required: true
          schema:
            type: object
            description: Exercise object
            properties:
                lesson_id:
                    type: string
                    example: "lesson_L1"
                    description: "ID of the lesson this exercise belongs to"
                    required: true
                exercise_type:
                    type: string
                    example: "translate"
                    description: "Type of the exercise, can be essay, answering, translate, organize, type_in_the_blank, select_in_the_blank, matching, or true_false"
                    required: true
                question:
                    type: string
                    example: "What is the capital of France?"
                    required: true
                    description: "The question or prompt for the exercise"
                text_support:
                    type: string
                    example: "Additional information"
                    description: "Additional text support for the exercise"
                    required: false
                image_files:
                    type: array
                    items:
                        type: string
                    example: ["/path/to/image1.png", "/path/to/image2.png"]
                    description: "List of image file paths associated with the exercise"
                    required: false
                audio_files:
                    type: array
                    items:
                        type: string
                    example: ["/path/to/audio1.mp3"]
                    description: "List of audio file paths associated with the exercise"
                    required: false
                answer:
                    type: string
                    example: "Paris"
                    required: true
                    description: "The correct answer for the exercise"
                vocabulary:
                    type: array
                    items:
                        type: string
                    example: ["voc_V1"]
                    description: "List of associated vocabulary IDs"
                    required: false
                calligraphy:
                    type: array
                    items:
                        type: string
                    example: ["call_C1"]
                    description: "List of associated calligraphy IDs"
                    required: false
                grammar:
                    type: array
                    items:
                        type: string
                    example: ["gram_G1"]
                    description: "List of associated grammar IDs"
                    required: false
    responses:
        201:
            description: Exercise created successfully
            schema:
                type: object
                description: Created Exercise object
        400:
            description: Validation error or bad request
    """
    try:
        # Validate request data
        data = ExerciseDict(**request.json)
        require_owns(data.lesson_id)

        # Create exercise
        exercise = exercise_service.create(data, as_dict=True)
        
        if exercise:
            return jsonify({
                'success': True,
                'exercise': exercise
            }), 201
        else:
            return jsonify({'error': 'Failed to create exercise'}), 400
            
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': e.errors()}), 400


@bp.route('/<exercise_id>', methods=['PUT', 'PATCH'])
@login_required
def update_exercise(exercise_id: str):
    """Update a exercise.
    ---
    tags:
        - Exercise
    parameters:
        - name: exercise_id
          in: path
          type: string
          required: true
          description: The ID of the exercise to update
          example: "ex_E1"
        - name: body
          in: body
          required: true
          schema:
            type: object
            description: Exercise object
            properties:
                lesson_id:
                    type: string
                    example: "lesson_L1"
                    description: "ID of the lesson this exercise belongs to"
                    required: true
                exercise_type:
                    type: string
                    example: "translate"
                    description: "Type of the exercise, can be essay, answering, translate, organize, type_in_the_blank, select_in_the_blank, matching, or true_false"
                    required: true
                question:
                    type: string
                    example: "What is the capital of France?"
                    required: true
                    description: "The question or prompt for the exercise"
                text_support:
                    type: string
                    example: "Additional information"
                    description: "Additional text support for the exercise"
                    required: false
                image_files:
                    type: array
                    items:
                        type: string
                    example: ["/path/to/image1.png", "/path/to/image2.png"]
                    description: "List of image file paths associated with the exercise"
                    required: false
                audio_files:
                    type: array
                    items:
                        type: string
                    example: ["/path/to/audio1.mp3"]
                    description: "List of audio file paths associated with the exercise"
                    required: false
                answer:
                    type: string
                    example: "Paris"
                    required: true
                    description: "The correct answer for the exercise"
                vocabulary:
                    type: array
                    items:
                        type: string
                    example: ["voc_V1"]
                    description: "List of associated vocabulary IDs"
                    required: false
                calligraphy:
                    type: array
                    items:
                        type: string
                    example: ["call_C1"]
                    description: "List of associated calligraphy IDs"
                    required: false
                grammar:
                    type: array
                    items:
                        type: string
                    example: ["gram_G1"]
                    description: "List of associated grammar IDs"
                    required: false
    responses:
        201:
            description: Exercise created successfully
            schema:
                type: object
                description: Created Exercise object
        400:
            description: Validation error or bad request
    """
    try:
        require_write(exercise_id)
        data = ExerciseDict(**request.json)

        exercise = exercise_service.update(exercise_id, data, as_dict=True)
        
        if exercise:
            return jsonify({
                'success': True,
                'exercise': exercise
            })
        else:
            return jsonify({'error': 'exercise not found'}), 404
            
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': e.errors()}), 400


@bp.route('/<exercise_id>', methods=['DELETE'])
@login_required
def delete_exercise(exercise_id: str):
    """Delete an exercise.
    ---
    tags:
        - Exercise
    parameters:
        - name: exercise_id
          in: path
          type: string
          required: true
          description: The ID of the exercise to delete
          example: "ex_E1"
    responses:
        204:
            description: Exercise deleted successfully
        404:
            description: Exercise not found
    """
    require_owns(exercise_id)
    success = exercise_service.delete(exercise_id)
    
    if success:
        return jsonify({'success': True}), 204
    else:
        return jsonify({'error': 'exercise not found'}), 404
    
@bp.route('/score', methods=['POST'])
@login_required
def score_exercise():
    """Score an exercise.
    ---
    tags:
        - Exercise
    parameters:
        - name: body
          in: body
          required: true
          schema:
            type: object
            description: Score update object
            properties:
                exercise_id:
                    type: string
                    example: "ex_E1"
                    description: "ID of the exercise to score"
                    required: true
                score:
                    type: number
                    example: 0.8
                    description: "The score for the exercise"
                    required: true
                attempt_number:
                    type: integer
                    example: 2
                    description: "The number of attempts made for the exercise"
                    required: false
    responses:
        200:
            description: Exercise scored successfully
            schema:
                type: object
                description: Updated Exercise object
        404:
            description: Exercise not found
    """
    data = request.json
    exercise_id = data['exercise_id']
    require_write(exercise_id)
    score = float(data['score'])
    duration_ms = float(data['duration_ms'])
    hint_used = bool(data.get('hint_used', False))
    attempt_number = int(data['attempt_number']) if data.get('attempt_number') is not None else None

    if owner_user_id(exercise_id) != current_user_id():
        CollaborationProgressService().record(current_user_id(), exercise_id, score)
        return jsonify({'success': True})

    exercise = exercise_service.update_score(
        exercise_id,
        score,
        duration_ms=duration_ms,
        hint_used=hint_used,
        attempt_number=attempt_number,
        as_dict=True,
        include_relations=False,
    )
    
    if exercise:
        return jsonify({
            'success': True,
            'exercise': exercise
        })
    else:
        return jsonify({'error': 'exercise not found'}), 404