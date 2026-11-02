from flask import Blueprint, request, jsonify
from pydantic import ValidationError

from ...services import LessonService
from ...services.system_data import ScoreService, LessonShareService, CollaborationService
from ...schemas.containers import LessonDict
from ...core.auth import login_required, require_owns, require_write, current_user_id, owner_user_id

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
    return jsonify(ScoreService().merge(current_user_id(), lessons))


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
    
    return jsonify(ScoreService().merge(current_user_id(), [lesson])[0])


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
        require_write(data.language_id)
        # A lesson belongs to its language's owner (a collaborator adds to the master's course);
        # never the model default "user_U0".
        data.user_id = owner_user_id(data.language_id)

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


@bp.route('/reorder', methods=['POST'])
@login_required
def reorder_lessons():
    """Set the order of a language's lessons.
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
                language_id: {type: string}
                ids: {type: array, items: {type: string}, description: "every lesson id of the language, in the new order"}
    responses:
        200: {description: Order saved}
        400: {description: ids are not exactly the language's lessons}
        403: {description: Not the language's owner}
    """
    body = request.get_json(silent=True) or {}
    language_id, ids = body.get('language_id'), body.get('ids')
    if not isinstance(language_id, str) or not isinstance(ids, list):
        return jsonify({'error': 'language_id and ids are required'}), 400
    require_owns(language_id)
    if not lesson_service.reorder(language_id, ids):
        return jsonify({'error': "ids must be exactly the language's lessons, once each"}), 400
    return jsonify({'success': True})


@bp.route('/bulk-delete', methods=['POST'])
@login_required
def bulk_delete_lessons():
    """Delete several lessons at once; all or nothing.
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
                ids: {type: array, items: {type: string}}
    responses:
        200: {description: "{deleted: n}"}
        400: {description: No ids}
        403: {description: Not the owner of every lesson (nothing is deleted)}
    """
    ids = (request.get_json(silent=True) or {}).get('ids')
    if not isinstance(ids, list) or not ids or not all(isinstance(i, str) for i in ids):
        return jsonify({'error': 'ids must be a non-empty list'}), 400
    ids = list(dict.fromkeys(ids))
    for lesson_id in ids:       # check everything before deleting anything
        require_owns(lesson_id)
    return jsonify({'deleted': lesson_service.bulk_delete(ids)})


@bp.route('/merge', methods=['POST'])
@login_required
def merge_lessons():
    """Merge the second lesson into the first (same language); keeps every item.
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
                first_id: {type: string, description: "survives, keeps its id, shares and collaborators"}
                second_id: {type: string, description: "its items move to the first, then it is deleted"}
                title: {type: string}
                description: {type: string}
                level: {type: integer}
    responses:
        200: {description: The merged lesson}
        400: {description: Invalid request (same lesson, other language, blank title)}
        403: {description: Not the owner of both lessons}
        404: {description: A lesson was not found}
    """
    body = request.get_json(silent=True) or {}
    first_id, second_id = body.get('first_id'), body.get('second_id')
    title = str(body.get('title') or '').strip()
    level = body.get('level')
    if not isinstance(first_id, str) or not isinstance(second_id, str) or not title:
        return jsonify({'error': 'first_id, second_id and a title are required'}), 400
    if level is not None and (isinstance(level, bool) or not isinstance(level, int)):
        return jsonify({'error': 'level must be an integer'}), 400
    require_owns(first_id)
    require_owns(second_id)
    merged = lesson_service.merge(first_id, second_id, title, body.get('description'), level,
                                  user_id=current_user_id(), as_dict=True)
    if merged is None:
        return jsonify({'error': 'The lessons must be two different lessons of the same language'}), 400
    return jsonify(merged)


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
    CollaborationService().purge_target("lesson", lesson_id)
    success = lesson_service.delete(lesson_id)

    if success:
        return jsonify({'success': True}), 204
    else:
        return jsonify({'error': 'Lesson not found'}), 404

@bp.route('/<lesson_id>/share', methods=['POST'])
@login_required
def share_lesson(lesson_id: str):
    """Share a lesson (co-editable) with another user."""
    data = request.json or {}
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({'error': 'user_id required'}), 400
    require_owns(lesson_id)
    lesson = LessonService().get_by_id(lesson_id)
    if not CollaborationService().has_partial_collaboration(current_user_id(), user_id, lesson.language_id):
        return jsonify({'error': 'Invite this user first'}), 403
    LessonShareService().share(lesson_id, user_id)
    return jsonify({'success': True}), 200


@bp.route('/<lesson_id>/share', methods=['DELETE'])
@login_required
def unshare_lesson(lesson_id: str):
    """Stop sharing a lesson with another user."""
    data = request.json or {}
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({'error': 'user_id required'}), 400
    require_owns(lesson_id)
    # also ends the partial collaboration once nothing is shared any more, so the master can re-invite
    CollaborationService().leave_lesson(lesson_id, user_id)
    return jsonify({'success': True}), 200


@bp.route('/<lesson_id>/collaborators', methods=['GET'])
@login_required
def lesson_collaborators(lesson_id: str):
    """Users this lesson is shared with (owner only)."""
    require_owns(lesson_id)
    return jsonify(LessonShareService().list_recipients(lesson_id))


@bp.route('/shared', methods=['GET'])
@login_required
def shared_lessons():
    """Lessons shared with the current user (partial collaboration)."""
    dicts = LessonShareService().list_shared_lessons(current_user_id())
    return jsonify(ScoreService().merge(current_user_id(), dicts))


@bp.route('/<lesson_id>/leave', methods=['DELETE'])
@login_required
def leave_shared_lesson(lesson_id: str):
    """Stop collaborating on a shared lesson (remove the current user's access)."""
    CollaborationService().leave_lesson(lesson_id, current_user_id())
    return jsonify({'success': True}), 200
