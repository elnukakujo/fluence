from flask import Blueprint, request, jsonify

from ...core.auth import login_required, require_write, current_user_id
from ...services.features import StudyGoalService

bp = Blueprint('study_goal', __name__, url_prefix='/api/study-goal')
service = StudyGoalService()


@bp.route('/<language_id>', methods=['GET'])
@login_required
def get_study_goal(language_id: str):
    """The current user's study goal for a language, with this cycle's progress.
    ---
    tags:
        - StudyGoal
    responses:
        200: {description: "{goal, progress, suggested}; a language without a goal gets the suggested one"}
    """
    require_write(language_id)
    user_id = current_user_id()
    goal = service.ensure_default(user_id, language_id)       # no goal yet: the suggested one for the daily minutes
    return jsonify({"goal": goal, "progress": service.progress(user_id, language_id), "suggested": service.suggested(user_id)})


@bp.route('/<language_id>', methods=['PUT'])
@login_required
def put_study_goal(language_id: str):
    """Create or update the goal: one period, separate new / review quantities per type. They apply from the next
    period; the running one stays locked.
    ---
    tags:
        - StudyGoal
    responses:
        200: {description: "{goal, progress}"}
        400: {description: Bad period or quantity}
    """
    require_write(language_id)
    data = request.json or {}
    user_id = current_user_id()
    try:
        goal = service.upsert(user_id, language_id, data.get('period'), data.get('n_vocabulary', 0),
                              data.get('n_grammar', 0), data.get('n_calligraphy', 0), data.get('active', True),
                              data.get('r_vocabulary', 0), data.get('r_grammar', 0), data.get('r_calligraphy', 0),
                              bool(data.get('auto', False)))
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify({"goal": goal, "progress": service.progress(user_id, language_id), "suggested": service.suggested(user_id)})
