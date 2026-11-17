from flask import Blueprint, jsonify

from ...core.auth import current_user_id, login_required
from ...services.capabilities import all_capabilities

bp = Blueprint('capabilities', __name__, url_prefix='/api/capabilities')


@bp.route('', methods=['GET'])
@login_required
def get_capabilities():
    """What the learner may use of the optional AI features, each with the reason when not.
    ---
    tags:
      - Capabilities
    responses:
      200:
        description: "{feature: {enabled, reason, needs}} for text_gen, tutor_feedback, exercise_generation, import, ocr_model, tts"
    """
    return jsonify(all_capabilities(current_user_id()))
