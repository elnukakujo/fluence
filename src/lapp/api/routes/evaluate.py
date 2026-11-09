from flask import Blueprint, request, jsonify
import traceback
import logging

from ...services import EvaluatorService, LanguageService
from ...utils import get_language_by_iso2t
from ...core.auth import login_required, require_owns, require_write
from ...utils.typed_similarity import closeness, diff

bp = Blueprint('evaluate', __name__, url_prefix='/api/evaluate')
evaluator_service = EvaluatorService()
logger = logging.getLogger(__name__)

@bp.route('/text', methods=['POST'])
@login_required
def evaluate_text():
    """Evaluate a text answer for an exercise.
    ---
    tags:
        - Evaluation
    parameters:
        - name: body
          in: body
          required: true
          schema:
            type: object
            description: Text evaluation object
            properties:
                exercise_id:
                    type: string
                    example: "ex_E1"
                    description: "ID of the exercise to evaluate"
                    required: true
                user_text:
                    type: string
                    example: "Hello, my name is John."
                    description: "The user's text answer to evaluate"
                    required: true
    responses:
        200:
            description: Text evaluated successfully
            schema:
                type: object
                description: Evaluation result object with score and tokens information
        500:
            description: Evaluation failed
    """
    try:
        data = request.json or {}
        require_write(data.get('exercise_id', ''))
        return evaluator_service.evaluate(
            ex_id=data.get('exercise_id', ''),
            user_input=data.get('user_text', ''),
            input_type='text'
        )
    except Exception:
        logger.error("evaluate_text failed:\n%s", traceback.format_exc())
        return jsonify({"correct": False, "score": 0.0, "feedback": "Evaluation unavailable. Please try again."}), 200

@bp.route('/speech', methods=['POST'])
@login_required
def evaluate_speech():
    """Evaluate a speech answer for an exercise.
    ---
    tags:
        - Evaluation
    parameters:
        - name: body
          in: body
          required: true
          schema:
            type: object
            description: Speech evaluation object
            properties:
                exercise_id:
                    type: string
                    example: "ex_E1"
                    description: "ID of the exercise to evaluate"
                correct_audio_index:
                    type: integer
                    example: 0
                    description: "Index of the correct audio file to compare against (default is 0)"
                user_audio_url:
                    type: string
                    example: "/path/to/audio1.mp3"
                    description: "URL of the user's audio answer to evaluate"
    responses:
        200:
            description: Speech evaluated successfully
            schema:
                type: object
                description: Evaluation result object with score and feedback information
        500:
            description: Evaluation failed
    """
    try:
        data = request.json or {}
        require_write(data.get('exercise_id', ''))
        return evaluator_service.evaluate(
            ex_id=data.get('exercise_id', ''),
            user_input=data.get('user_audio_url', ''),
            input_type='speech',
            correct_audio_index=data.get('correct_audio_index', 0)
        )
    except Exception:
        logger.error("evaluate_speech failed:\n%s", traceback.format_exc())
        return jsonify({"correct": False, "score": 0.0, "feedback": "Evaluation unavailable. Please try again."}), 200

@bp.route('/typed-answer', methods=['POST'])
@login_required
def score_typed_answer():
    """Character-level closeness of a typed target-language answer to the expected text.
    ---
    tags:
        - Evaluation
    parameters:
        - name: body
          in: body
          required: true
          schema:
            type: object
            properties:
                text:
                    type: string
                    description: "What the user typed"
                expected:
                    type: string
                    description: "The expected text"
                    required: true
                iso1:
                    type: string
                    description: "ISO 639-1 code of the target language (enables phonetic leniency)"
                language_id:
                    type: string
                    description: "Alternative to iso1: the user's language, whose target ISO code is used"
    responses:
        200:
            description: closeness in 0..1 and the indices of `expected` that differ
        400:
            description: expected is missing
    """
    data = request.get_json(silent=True) or {}
    if not isinstance(data.get("expected"), str) or not data["expected"]:
        return jsonify({"error": "expected is required"}), 400
    text, expected, iso1 = data.get("text") or "", data["expected"], data.get("iso1")
    if not iso1 and data.get("language_id"):         # the client knows the language id, not its ISO code
        require_owns(data["language_id"])
        iso1 = get_language_by_iso2t(LanguageService().get_by_id(data["language_id"]).target_iso639_2t).iso1
    return jsonify({"closeness": closeness(text, expected, iso1=iso1), "diff": diff(text, expected, iso1=iso1)})
