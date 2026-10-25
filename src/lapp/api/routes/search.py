from flask import Blueprint, jsonify, request

from ...services import SearchService
from ...core.auth import login_required, current_user_id

bp = Blueprint("search", __name__, url_prefix="/api/search")
search_service = SearchService()


@bp.route("", methods=["GET"])
@login_required
def search_elements():
    query = (request.args.get("q") or "").strip()
    if len(query) < 1:
        return jsonify({"error": "Query must be at least 1 character long"}), 400

    results = search_service.search_elements(user_id=current_user_id(), query=query)
    return jsonify({"results": results}), 200
