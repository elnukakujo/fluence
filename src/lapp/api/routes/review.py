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
    cards = ScoreService().merge(current_user_id(), cards)
    return jsonify(review_service.annotate_leeches(cards, current_user_id(), language_id))


NOTE_MAX = 500


@bp.route('/note/<element_id>', methods=['PUT'])
@login_required
def set_note(element_id: str):
    """Save the user's own note (mnemonic) on a card; an empty note clears it.
    ---
    tags:
        - Review
    parameters:
        - {name: element_id, in: path, type: string, required: true}
    responses:
        200: {description: saved}
        400: {description: note is not a string of at most 500 characters}
        404: {description: unknown element}
    """
    require_write(element_id)
    note = (request.get_json(silent=True) or {}).get('note')
    if not isinstance(note, str) or len(note) > NOTE_MAX:
        return jsonify({'error': f'note must be text of at most {NOTE_MAX} characters'}), 400
    ScoreService().set_note(current_user_id(), element_id, note.strip())
    return jsonify({'ok': True})



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
