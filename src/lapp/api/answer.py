from flask import jsonify, request

from ..core.auth import current_user_id
from ..schemas.answer import parse_answer
from ..services.system_data import ScoreService
from ..services.system_data.prefs_view import remember_timezone
from ..utils.scoring import level_for


def _level(element_id: str):
    row = ScoreService().get(current_user_id(), element_id)
    return level_for(row.score) if row else "learning"


def answered(element_id: str, data, record):
    """Shared body of the score routes: validate the answer, call `record(payload)`, report the level change."""
    try:
        payload = parse_answer(element_id, data or {})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    remember_timezone(current_user_id(), request.headers.get('X-Timezone'))     # the answer lands on the learner's own day
    before = _level(element_id)
    if not record(payload):
        return jsonify({'error': 'not found'}), 404
    return jsonify({'success': True, 'level_before': before, 'level_after': _level(element_id)})
