from flask import Blueprint, jsonify, request

from ...services import ReviewService
from ...services.features.review_queue import Scope
from ...services.system_data import ScoreService
from ...services.data_collection import StudyActivity
from ...services.data_collection.weekly_snapshot import WeeklySnapshotService
from ...services.system_data.prefs_view import prefs_for, remember_timezone
from ...core.auth import login_required, require_owns, require_write, current_user_id

bp = Blueprint('review', __name__, url_prefix='/api/review')
review_service = ReviewService()


def _queue(language_id: str, scope: Scope):
    require_write(language_id)
    cards = review_service.get_review_cards(language_id, user_id=current_user_id(), as_dict=True, scope=scope)
    cards = ScoreService().merge(current_user_id(), cards)
    return jsonify(review_service.annotate_leeches(cards, current_user_id(), language_id))


SCOPES = ("daily", "lesson", "tag", "source", "type", "free")


@bp.route('/<language_id>/queue', methods=['GET'])
@login_required
def get_scoped_queue(language_id: str):
    """The review queue of one entry point, all in the same item shape.

    ---
    tags:
        - Review
    parameters:
        - {name: language_id, in: path, type: string, required: true}
        - {name: scope, in: query, type: string, enum: [daily, lesson, tag, source, type, free], required: true}
        - {name: lesson_id, in: query, type: string}
        - {name: tag_id, in: query, type: string}
        - {name: source_id, in: query, type: string}
        - {name: type, in: query, type: string, description: vocabulary, grammar, calligraphy, character or exercise}
        - {name: ids, in: query, type: string, description: comma-separated element ids (scope=free)}
    responses:
        200: {description: "Queue items: the card fields plus kind, skill, bonus, est_seconds, leech"}
        400: {description: unknown scope, or the scope's id is missing}
    """
    a = request.args
    kind = a.get('scope', 'daily')
    needs = {'lesson': 'lesson_id', 'tag': 'tag_id', 'source': 'source_id', 'type': 'type'}
    if kind not in SCOPES or (kind in needs and not a.get(needs[kind])) or (kind == 'free' and not a.get('ids')):
        return jsonify({'error': 'unknown scope or missing id'}), 400
    return _queue(language_id, Scope(kind=kind, lesson_id=a.get('lesson_id'), tag_id=a.get('tag_id'), source_id=a.get('source_id'),
                                     element_type=a.get('type'),
                                     ids=[i for i in a.get('ids', '').split(',') if i]))


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
    return _queue(language_id, Scope())


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
    """The daily review queue was finished: validate today for the streak (once per day), if the learner answered at least once today.

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
            description: "{streak: current streak length, validated: whether today is a streak day, just_validated: this call made it one}"
    """
    require_write(language_id)
    remember_timezone(current_user_id(), request.headers.get('X-Timezone'))
    status = StudyActivity().complete_queue(current_user_id(), language_id)
    WeeklySnapshotService().catch_up(current_user_id(), prefs_for(current_user_id()).timezone)       # a missed week is written on the first visit after it closed
    return jsonify({"streak": status.streak, "validated": status.validated, "just_validated": status.just_validated})
