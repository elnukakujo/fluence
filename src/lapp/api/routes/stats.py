from flask import Blueprint, jsonify, request

from ...utils.learner_clock import learner_today
from ...core.auth import current_user_id, login_required, require_write
from ...services.data_collection import home_stats
from ...services.system_data.prefs_view import prefs_for, remember_timezone

bp = Blueprint('stats', __name__, url_prefix='/api/stats')


@bp.route('/home', methods=['GET'])
@login_required
def stats_home():
    """Headline numbers for the home page: streak, today's answers, per-language levels / fading / due, weekly answers, heatmap bands.
    ---
    tags:
      - stats
    responses:
      200:
        description: "{streak, today: {answers, min, validated}, languages: [...], weeks: [...], heatmap_bands, week_delta}"
    """
    user_id = current_user_id()
    remember_timezone(user_id, request.headers.get('X-Timezone'))
    return jsonify(home_stats.home(user_id, prefs_for(user_id).timezone))


@bp.route('/<language_id>/summary', methods=['GET'])
@login_required
def stats_language_summary(language_id: str):
    """One language's headline numbers (levels, fading, coverage, due), the entry `/home` lists for it.
    ---
    tags:
      - stats
    responses:
      200:
        description: "{id, name, levels, fading, coverage, mean_seen, due, due_minutes, minutes_today}"
      404:
        description: Not the caller's language, or it does not exist
    """
    user_id = current_user_id()
    remember_timezone(user_id, request.headers.get('X-Timezone'))
    out = home_stats.language_summary(user_id, language_id, learner_today(prefs_for(user_id).timezone))
    return (jsonify(out), 200) if out is not None else (jsonify({'error': 'Not found'}), 404)


@bp.route('/<language_id>/types', methods=['GET'])
@login_required
def stats_language_types(language_id: str):
    """Per studied type: total, seen, mean score of the seen ones, cards fading, cards due in the daily review (the custom review's Type tab).
    ---
    tags:
      - stats
    responses:
      200:
        description: "{vocabulary|grammar|calligraphy|exercise: {total, seen, mean_seen, fading, due}}"
      404:
        description: Not the caller's language, or it does not exist
    """
    out = home_stats.type_stats(current_user_id(), language_id)
    return (jsonify(out), 200) if out is not None else (jsonify({'error': 'Not found'}), 404)


@bp.route('/<language_id>/snapshots', methods=['GET'])
@login_required
def stats_snapshots(language_id: str):
    """Weekly level counts of a language (oldest first), coverage and counts as separate fields.
    ---
    tags:
      - stats
    parameters:
      - name: weeks
        in: query
        type: integer
        required: false
    responses:
      200:
        description: list of weekly snapshots
    """
    require_write(language_id)
    try:
        weeks = int(request.args.get('weeks', 12))
    except ValueError:
        return jsonify({'error': 'weeks must be an integer'}), 400
    return jsonify(home_stats.snapshots(current_user_id(), language_id, weeks))
