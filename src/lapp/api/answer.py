from flask import jsonify, request

from ..core.auth import current_user_id
from ..schemas.answer import parse_answer
from ..services.system_data import ScoreService
from ..services.system_data.prefs_view import remember_timezone
from ..utils.scoring import level_for


def _state(element_id: str) -> tuple[float, str]:
    """(effective score, level): a vocabulary's is computed from its sides, so it is read like the review does."""
    row = ScoreService().get_many(current_user_id(), [element_id]).get(element_id)
    score = row.score if row else 0.0
    return round(score, 1), level_for(score)


def answered(element_id: str, data, record):
    """Shared body of the score routes: validate the answer, call `record(payload)`, report the level change."""
    try:
        payload = parse_answer(element_id, data or {})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    remember_timezone(current_user_id(), request.headers.get('X-Timezone'))     # the answer lands on the learner's own day
    score_before, before = _state(element_id)
    if not record(payload):
        return jsonify({'error': 'not found'}), 404
    score_after, after = _state(element_id)
    return jsonify({'success': True, 'level_before': before, 'level_after': after, 'score_before': score_before, 'score_after': score_after})
