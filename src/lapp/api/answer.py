from datetime import date, datetime

from flask import jsonify, request

from ..core.auth import current_user_id
from ..schemas.answer import parse_answer
from ..services.system_data import ScoreService
from ..services.system_data.prefs_view import remember_timezone
from ..services.system_data.score import side_id
from ..utils.scoring import DAY_GAIN_CAP, effective_score, level_for


def _state(row_id: str, skill: str) -> tuple[float, str]:
    """(score as of now, level) of the one card the learner answered: the side's own row for a vocabulary, not the mean over its sides."""
    row = ScoreService().get(current_user_id(), row_id, skill)
    score = effective_score(row.score, row.stability, row.last_seen_at, datetime.now()) if row else 0.0
    return round(score, 1), level_for(score)


def answered(element_id: str, data, record):
    """Shared body of the score routes: validate the answer, call `record(payload)`, report the level change."""
    try:
        payload = parse_answer(element_id, data or {})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    remember_timezone(current_user_id(), request.headers.get('X-Timezone'))     # the answer lands on the learner's own day
    row_id = side_id(element_id, payload.side) if payload.side else element_id
    score_before, before = _state(row_id, payload.skill)
    if not record(payload):
        return jsonify({'error': 'not found'}), 404
    score_after, after = _state(row_id, payload.skill)
    row = ScoreService().get(current_user_id(), row_id, payload.skill)
    # nothing gained because the card already earned DAY_GAIN_CAP today: the result strip says so instead of "7 -> 7"
    # ponytail: the server's date, not the learner's zone; a late-night answer may read one day off
    capped = bool(row and row.day_date == date.today() and row.day_gain >= DAY_GAIN_CAP and score_after <= score_before)
    return jsonify({'success': True, 'level_before': before, 'level_after': after, 'score_before': score_before, 'score_after': score_after, 'capped': capped})
