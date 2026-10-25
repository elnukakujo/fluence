from flask import Blueprint, jsonify

from ...core.database import db_manager
from ...services import WordService
from ...core.auth import login_required, require_owns

bp = Blueprint("word", __name__, url_prefix="/api/word")
word_service = WordService()


@bp.route("/<word_id>", methods=["GET"])
@login_required
def get_word(word_id: str):
    require_owns(word_id)
    session = db_manager.get_session()
    try:
        word = word_service.get_by_id(word_id, session=session)
        if not word:
            return jsonify({"error": "Word not found"}), 404
        payload = word.to_dict()
        return jsonify(payload)
    finally:
        session.close()
