from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from ...core.database import db_manager
from ...schemas.components import CharacterDict
from ...services import CharacterService
from ...core.auth import login_required, require_owns, require_write

bp = Blueprint("character", __name__, url_prefix="/api/character")
character_service = CharacterService()


@bp.route("/radicals", methods=["GET"])
@login_required
def list_radicals():
    """The radicals the character form offers for this language (empty for languages without characters)."""
    language_id = request.args.get("language_id", "")
    require_owns(language_id)
    session = db_manager.get_session()
    try:
        return jsonify(character_service.radical_options(language_id, session=session))
    finally:
        session.close()


@bp.route("/<character_id>", methods=["GET"])
@login_required
def get_character(character_id: str):
    require_write(character_id)
    session = db_manager.get_session()
    try:
        character = character_service.get_by_id(character_id, session=session)
        if not character:
            return jsonify({"error": "Character not found"}), 404
        payload = character.to_dict()
        payload["used_in"] = character_service.used_in(character_id, character.language_id, session=session)
        by_id = {c.id: c for c in character_service.list_for_language(character.language_id, session=session)}
        ref = lambda i: {"id": i, "character": by_id[i].character} if i in by_id else None
        payload["key_radical"] = ref(character.key_radical_id)
        payload["component_refs"] = [r for r in map(ref, character.components or []) if r]
        payload["used_in_refs"] = [r for r in map(ref, payload["used_in"]) if r]
        payload["radical_of_refs"] = [ref(i) for i, c in by_id.items() if c.key_radical_id == character_id]
        payload["component_of_refs"] = [ref(i) for i, c in by_id.items() if character_id in (c.components or [])]
        return jsonify(payload)
    finally:
        session.close()


@bp.route("/", methods=["GET"])
@login_required
def list_characters():
    """Characters of a language; `?radicals=1` keeps only those used as key radical or component by another character."""
    language_id = request.args.get("language_id", "")
    require_owns(language_id)
    session = db_manager.get_session()
    try:
        chars = character_service.list_for_language(language_id, radicals=request.args.get("radicals") == "1", session=session)
        return jsonify([c.to_dict(include_relations=False) for c in chars])
    finally:
        session.close()


@bp.route("/", methods=["POST"])
@login_required
def create_character():
    try:
        data = CharacterDict.model_validate(request.get_json(silent=True) or {})
    except ValidationError as e:
        return jsonify({"error": str(e)}), 400
    require_owns(data.language_id)
    try:
        character = character_service.create(data)
    except ValueError as e:                     # Korean (DM-50), bad readings, links
        return jsonify({"error": str(e)}), 400
    return jsonify(character.to_dict(include_relations=False)), 201


@bp.route("/<character_id>/radical", methods=["POST"])
@login_required
def copy_radical(character_id: str):
    """Copy a catalogue radical into this character's language and make it its key radical (idempotent)."""
    require_owns(character_id)
    catalogue_id = (request.get_json(silent=True) or {}).get("catalogue_id")
    if not isinstance(catalogue_id, int):
        return jsonify({"error": "catalogue_id is required"}), 400
    try:
        radical = character_service.copy_radical(character_id, catalogue_id)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    if radical is None:
        return jsonify({"error": "Character or catalogue entry not found"}), 404
    return jsonify(radical.to_dict(include_relations=False))
