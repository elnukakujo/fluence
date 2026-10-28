from flask import Blueprint, request, jsonify
from pydantic import ValidationError

from ...services import LessonService
from ...schemas.containers import LessonDict
from ...core.auth import login_required, require_owns, require_write

bp = Blueprint('lesson', __name__, url_prefix='/api/lessons')
lesson_service = LessonService()

@bp.route('/all/<language_id>', methods=['GET'])
@login_required
def get_all_lessons(language_id: str):
    """Get all lessons.
    ---
    tags:
        - Lessons
    parameters:
        - name: language_id
          in: path
          type: string
          required: true
          description: The ID of the language to retrieve lessons from
    responses:
        200:
            description: List of lessons
            schema:
                type: array
                items:
                    type: object
                    description: Lesson object
    """
    require_write(language_id)
    lessons = lesson_service.get_all(language_id=language_id, as_dict=True)
    return jsonify(lessons)


@bp.route('/<lesson_id>', methods=['GET'])
@login_required
def get_lesson(lesson_id: str):
    """Get a specific lesson by ID.
    ---
    tags:
        - Lessons
    parameters:
        - name: lesson_id
          in: path
          type: string
          required: true
          description: The ID of the lesson to retrieve
    responses:
        200:
            description: Lesson object
            schema:
                type: object
        404:
            description: Lesson not found
    """
    require_write(lesson_id)
    lesson = lesson_service.get_by_id(lesson_id, as_dict=True)

    if not lesson:
        return jsonify({'error': 'Lesson not found'}), 404
    
    return jsonify(lesson)


@bp.route('/', methods=['POST'])
@login_required
def create_lesson():
    """Create a new lesson.
    ---
    tags:
      - Lessons
    parameters:
      - name: body
        in: body
        required: true
        schema:
            type: object
            properties:
                language_id:
                    type: string
                    required: true
                    description: The ID of the language the lesson belongs to
                    example: "lang_L1"
                title:
                    type: string
                    required: true
                    description: The title of the lesson
                    example: "Basic Phrases"
                description:
                    type: string
                    required: false
                    description: A brief description of the lesson
                    example: "This lesson covers basic phrases in the language."
                level:
                    type: number
                    required: false
                    description: The proficiency level of the lesson
                    example: 0
    responses:
        201:
            description: Lesson created successfully
            schema:
                type: object
                properties:
                    success:
                        type: boolean
                    lesson:
                        type: object
                        description: The created lesson object
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
        data = LessonDict(**request.json)
        require_owns(data.language_id)

        # Create lesson
        lesson = lesson_service.create(data, as_dict=True)
        
        if lesson:
            return jsonify({
                'success': True,
                'lesson': lesson
            }), 201
        else:
            return jsonify({'error': 'Failed to create lesson'}), 400
            
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': e.errors()}), 400


@bp.route('/<lesson_id>', methods=['PUT', 'PATCH'])
@login_required
def update_lesson(lesson_id: str):
    """Update a lesson.
    ---
    tags:
      - Lessons
    parameters:
      - name: lesson_id
        in: path
        type: string
        required: true
        description: The ID of the lesson to update
      - name: body
        in: body
        required: true
        schema:
            type: object
            properties:
                language_id:
                    type: string
                    description: The ID of the language the lesson belongs to
                    required: true
                    example: "lang_L1"
                title:
                    type: string
                    description: The title of the lesson
                    required: true
                    example: "Basic Phrases"
                description:
                    type: string
                    description: A brief description of the lesson
                    required: false
                    example: "This lesson covers basic phrases in the language."
                level:
                    type: number
                    description: The proficiency level of the lesson
                    required: false
                    example: 0
    """
    try:
        require_write(lesson_id)
        data = LessonDict(**request.json)

        lesson = lesson_service.update(lesson_id, data, as_dict=True)
        
        if lesson:
            return jsonify({
                'success': True,
                'lesson': lesson
            })
        else:
            return jsonify({'error': 'Lesson not found'}), 404
            
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': e.errors()}), 400


@bp.route('/<lesson_id>', methods=['DELETE'])
@login_required
def delete_lesson(lesson_id: str):
    """Delete a lesson.
    ---
    tags:
      - Lessons
    parameters:
      - name: lesson_id
        in: path
        type: string
        required: true
        description: The ID of the lesson to delete
    responses:
        204:
            description: Lesson deleted successfully
        404:
            description: Lesson not found
    """
    require_owns(lesson_id)
    success = lesson_service.delete(lesson_id)

    if success:
        return jsonify({'success': True}), 204
    else:
        return jsonify({'error': 'Lesson not found'}), 404