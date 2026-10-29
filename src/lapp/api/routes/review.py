from flask import Blueprint, jsonify

from ...services import ReviewService
from ...core.auth import login_required, require_owns, require_write

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
    cards = review_service.get_review_cards(language_id, as_dict=True)
    return jsonify(cards)
