from flask import Blueprint, jsonify, request

from ...services import ReviewService
from ...services.system_data import ScoreService
from ...services.data_collection.daily_stats import DailyStatsService
from ...services.features.study_constants import STREAK_MIN_CARDS
from ...core.auth import login_required, require_owns, require_write, current_user_id

bp = Blueprint('review', __name__, url_prefix='/api/review')
review_service = ReviewService()


@bp.route('/<language_id>', methods=['GET'])
@login_required
def get_review_cards(language_id: str):
    """Return today's daily-review flashcard queue for a language.

    ---
    tags:
        - Review
    parameters:
        - name: language_id
          in: path
          type: string
          required: true
          description: The ID of the language to build the review queue for
    responses:
        200:
            description: List of flashcards to review (mixed vocabulary/grammar/calligraphy)
            schema:
                type: array
                items:
                    type: object
    """
    require_write(language_id)
    cards = review_service.get_review_cards(language_id, user_id=current_user_id(), as_dict=True)
    return jsonify(ScoreService().merge(current_user_id(), cards))



@bp.route('/<language_id>/complete', methods=['POST'])
@login_required
def complete_review(language_id: str):
    """The daily review queue was finished: validate today for the streak (once per day).

    ---
    tags:
        - Review
    parameters:
        - name: language_id
          in: path
          type: string
          required: true
    responses:
        200:
            description: "{streak: current streak length, validated: whether today is now a streak day}"
    """
    require_write(language_id)
    cards = int((request.get_json(silent=True) or {}).get("cards") or 0)
    stats = DailyStatsService()
    if cards < STREAK_MIN_CARDS:
        today = stats.get_today_for_user(current_user_id(), language_id, as_dict=True, include_relations=False)
    else:
        today = stats.validate_day(current_user_id(), language_id, as_dict=True)
    return jsonify({"streak": today["current_streak_length"], "validated": bool(today["streak_day"])})
