from flask import Blueprint, jsonify

from ...core.database import db_manager
from ...services import PassageService
from ...core.auth import login_required, require_owns, require_write

bp = Blueprint("passage", __name__, url_prefix="/api/passage")
passage_service = PassageService()


@bp.route("/<passage_id>", methods=["GET"])
@login_required
def get_passage(passage_id: str):
    require_write(passage_id)
    session = db_manager.get_session()
    try:
        passage = passage_service.get_by_id(passage_id, session=session)
        if not passage:
            return jsonify({"error": "Passage not found"}), 404
        payload = passage.to_dict()
        return jsonify(payload)
    finally:
        session.close()
