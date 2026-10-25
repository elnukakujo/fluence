from datetime import date

from flask import Blueprint, jsonify, request

import logging

from ...services.data_collection import DailyStatsService
from ...services.system_data import UserService
from ...services.containers import LanguageService
from ...core.auth import login_required, require_owns, current_user_id

logger = logging.getLogger(__name__)

bp = Blueprint('daily_stats', __name__, url_prefix='/api/daily-stats')
daily_stats_service = DailyStatsService()
user_service = UserService()
language_service = LanguageService()

@bp.route('/me/today', methods=['GET'])
@login_required
def get_daily_stats_today():
    """Get today's daily stats for the current user and language.
    ---
    tags:
      - daily-stats
    parameters:
      - name: user_id
        in: query
        type: string
        required: true
      - name: language_id
        in: query
        type: string
        required: true
    responses:
      200:
        description: Daily stats object
    """
    language_id = request.args.get('language_id')

    if not language_id:
        return jsonify({'error': 'language_id is required'}), 400

    require_owns(language_id)

    daily_stats = daily_stats_service.get_today_for_user(
        user_id=current_user_id(),
        language_id=language_id,
        as_dict=True,
        include_relations=False,
    )
    return jsonify(daily_stats)


@bp.route('/me/history', methods=['GET'])
@login_required
def get_daily_stats_history():
    """Get daily stats for a date range (defaults to since account creation) — for a GitHub-style practice heatmap.
    ---
    tags:
      - daily-stats
    parameters:
      - name: user_id
        in: query
        type: string
        required: true
      - name: language_id
        in: query
        type: string
        required: false
        description: Restrict to a single language; omit for stats across all of the user's languages
      - name: start_date
        in: query
        type: string
        required: false
        description: ISO date, defaults to the user's account creation date
      - name: end_date
        in: query
        type: string
        required: false
        description: ISO date, defaults to today
    responses:
      200:
        description: List of daily stats entries
      404:
        description: User or language not found
    """
    user_id = current_user_id()
    language_id = request.args.get('language_id')

    user = user_service.get_by_id(user_id=user_id)
    if user is None:
        return jsonify({'error': 'User not found'}), 404
    if language_id:
        require_owns(language_id)

    start_date_param = request.args.get('start_date')
    end_date_param = request.args.get('end_date')
    start_date = date.fromisoformat(start_date_param) if start_date_param else user.created_at.date()
    end_date = date.fromisoformat(end_date_param) if end_date_param else date.today()

    history = daily_stats_service.get_range_for_user(
        user_id=user_id,
        language_id=language_id,
        start_date=start_date,
        end_date=end_date,
        as_dict=True,
        include_relations=False,
    )
    return jsonify(history)


@bp.route('/<daily_stats_id>', methods=['GET'])
@login_required
def get_daily_stats_by_id(daily_stats_id: str):
    """Get a single daily stats entry by ID.
    ---
    tags:
      - daily-stats
    parameters:
      - name: daily_stats_id
        in: path
        type: string
        required: true
      - name: user_id
        in: query
        type: string
        required: true
    responses:
      200:
        description: Daily stats object
      403:
        description: Forbidden
      404:
        description: Not found
    """
    user_id = current_user_id()

    daily_stats = daily_stats_service.get_by_id(
        daily_stats_id=daily_stats_id,
        as_dict=True,
        include_relations=False,
    )

    if not daily_stats:
        return jsonify({'error': 'Daily stats not found'}), 404

    if daily_stats.get('user_id') != user_id:
        return jsonify({'error': 'Forbidden'}), 403

    return jsonify(daily_stats)