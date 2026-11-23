import logging
from flask import Blueprint, request, jsonify
from pydantic import ValidationError

from ...services import ExerciseService
from ...services.system_data import ScoreService, ExerciseUserPrefService, SourceService
from ...schemas import ExerciseDict
from ...schemas.answer import parse_exercise_answer
from ...core.auth import login_required, require_owns, require_write, current_user_id
from ...services.system_data import UserPreferencesService
from ...services.capabilities import capability_for, gated_api
from ...utils.request import parse_json
from ...core.database import db_manager
from ...services.features.exercise import lesson_has_grammar
from ...services.features.studied_types import studied_types
from ...models.containers import Lesson
logger = logging.getLogger(__name__)
bp = Blueprint('exercise', __name__, url_prefix='/api/exercise')
exercise_service = ExerciseService()
_LINKS = {"related_vocabulary": "vocabulary", "related_grammar": "grammar", "related_calligraphy": "calligraphy"}


def _visible_links(items: list[dict]) -> list[dict]:
    """SG-14: links to a type the exercise's language does not study stay stored but are not shown (re-enabling the type brings them back)."""
    with db_manager.session_scope() as s:
        language_of = dict(s.query(Lesson.id, Lesson.language_id).filter(Lesson.id.in_({i["lesson_id"] for i in items})).all())
        studied = {lang: studied_types(current_user_id(), lang, session=s) for lang in set(language_of.values())}
    for item in items:
        for key, kind in _LINKS.items():
            if kind not in studied.get(language_of.get(item["lesson_id"]), (kind,)):
                item[key] = []
    return items

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
    return jsonify(_visible_links(ExerciseUserPrefService().annotate(current_user_id(), ScoreService().merge(current_user_id(), exercise))))


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
    SourceService().link_generated_exercises(current_user_id(), lesson_id)   # exercises generated before the shared AI source existed
    exercise = exercise_service.get_all(lesson_id=lesson_id, as_dict=True)
    return jsonify(_visible_links(ExerciseUserPrefService().annotate(current_user_id(), ScoreService().merge(current_user_id(), exercise))))


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
    
    return jsonify(_visible_links(ExerciseUserPrefService().annotate(current_user_id(), ScoreService().merge(current_user_id(), [exercise])))[0])


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
        data = parse_json(ExerciseDict)
        require_write(data.lesson_id)
        if not data.machine_made and not data.related_grammar:      # a hand-made exercise names a grammar of its lesson (EX-17)
            with db_manager.session_scope() as s:
                if lesson_has_grammar(data.lesson_id, s):
                    return jsonify({'error': 'grammar_required'}), 400

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
        data = parse_json(ExerciseDict)

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
    require_write(exercise_id)
    success = exercise_service.delete(exercise_id)
    
    if success:
        return jsonify({'success': True}), 204
    else:
        return jsonify({'error': 'exercise not found'}), 404
    
@bp.route('/score', methods=['POST'])
@login_required
def score_exercise():
    """Credit the elements of an exercise attempt (only the final attempt counts).
    ---
    tags:
        - Exercise
    parameters:
        - name: body
          in: body
          required: true
          schema:
            type: object
            properties:
                exercise_id: {type: string, example: "ex_E1"}
                results:
                    type: array
                    description: "One entry per blank / pair, or one per linked element at the exercise quality"
                    items:
                        type: object
                        properties:
                            element_id: {type: string, example: "voc_V1"}
                            quality: {type: number, example: 1.0}
                            skill: {type: string, enum: [recognition, recall]}
                            evidence_type: {type: string, enum: [typed, spoken, self_grade, multiple_choice, matching]}
                attempt: {type: integer, example: 2}
                final: {type: boolean, description: "false posts nothing"}
                duration_ms: {type: integer}
                hint_used: {type: boolean}
    responses:
        200:
            description: "{success, correct, total, summary}; summary = {before, after, level, level_up}: the mean score change of the elements it credited, for the bar under the card"
        400:
            description: Invalid body, or a result names an element the exercise is not linked to
        404:
            description: Exercise not found
    """
    data = request.json or {}
    exercise_id = data.get('exercise_id')
    require_write(exercise_id)
    try:
        answer = parse_exercise_answer(data)
        if not answer.final:
            return jsonify({'success': True, 'credited': False})
        counts = exercise_service.credit(
            exercise_id, [r.model_dump() for r in answer.results], user_id=current_user_id(),
            duration_ms=answer.duration_ms, hint_used=answer.hint_used, attempt=answer.attempt)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    if counts is None:
        return jsonify({'error': 'not found'}), 404
    return jsonify({'success': True, **counts})

@bp.route('/<exercise_id>/override', methods=['POST'])
@login_required
def override_exercise(exercise_id: str):
    """The learner says a wrong final attempt was right ("I was right"): credit it at full quality, once per attempt.
    ---
    tags:
        - Exercise
    parameters:
        - name: body
          in: body
          required: true
          schema:
            type: object
            properties:
                attempt_id: {type: string, description: "One id per runner attempt, chosen by the client"}
                results: {type: array, description: "The attempt's results, as posted to /score"}
                attempt: {type: integer}
                duration_ms: {type: integer}
                hint_used: {type: boolean}
    responses:
        200:
            description: "{credited: false} when nothing was wrong or the attempt was overridden before; else {credited: true, correct, total}"
        400:
            description: Invalid body
        404:
            description: Exercise not found
    """
    data = dict(request.json or {}, exercise_id=exercise_id, final=True)
    require_write(exercise_id)
    attempt_id = data.get('attempt_id')
    if not attempt_id:
        return jsonify({'error': 'attempt_id is required'}), 400
    try:
        answer = parse_exercise_answer(data)
        out = exercise_service.override(exercise_id, current_user_id(), str(attempt_id), [r.model_dump() for r in answer.results],
                                        answer.duration_ms, hint_used=answer.hint_used, attempt=answer.attempt)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    if out is None:
        return jsonify({'error': 'not found'}), 404
    return jsonify({'success': True, **out})


@bp.route('/<exercise_id>/line-audio', methods=['POST'])
@login_required
def generate_line_audio(exercise_id: str):
    """Generate (user's TTS endpoint) and store the clip of one line of a reading / dictation exercise.
    ---
    tags:
        - Exercise
    responses:
        200: {description: "audio_files and content with the line's audioIndex"}
        409: {description: "tts_not_configured: no active TTS endpoint, or AI TTS is turned off"}
        502: {description: "tts_failed: the TTS endpoint returned an error"}
    """
    require_write(exercise_id)
    line = (request.json or {}).get('line')
    if not isinstance(line, int) or isinstance(line, bool):
        return jsonify({'error': 'line must be an integer'}), 400
    prefs = UserPreferencesService().get_by_user_id(current_user_id())
    api = gated_api(prefs, "tts")
    if not api or not api.get("base_url"):
        cap = capability_for(prefs, "tts")
        return jsonify({'error': 'tts_not_configured', 'reason': cap.reason, 'needs': cap.needs}), 409
    try:
        return jsonify(exercise_service.add_line_audio(exercise_id, line, api))
    except FileNotFoundError:
        return jsonify({'error': 'exercise not found'}), 404
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception:   # the endpoint is the user's: a bad key, a down server, an unsupported language
        logger.exception("line audio failed for %s", exercise_id)
        return jsonify({'error': 'tts_failed'}), 502


@bp.route('/<exercise_id>/user-pref', methods=['PUT'])
@login_required
def set_exercise_user_pref(exercise_id: str):
    """Boost or ban an exercise for the current user only (null removes it).
    ---
    tags:
        - Exercise
    responses:
        200: {description: "{mode}"}
        400: {description: Unknown mode}
    """
    require_write(exercise_id)
    mode = (request.json or {}).get('mode')
    try:
        ExerciseUserPrefService().set(current_user_id(), exercise_id, mode)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify({'mode': mode})
