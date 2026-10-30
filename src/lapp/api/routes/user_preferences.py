from flask import Blueprint, request, jsonify
from pydantic import ValidationError
import logging
logger = logging.getLogger(__name__)

from ...schemas.system_data import UserPreferencesDict
from ...services.system_data import UserPreferencesService
from ...core.auth import login_required, require_owns, current_user_id
user_preferences_service = UserPreferencesService()

bp = Blueprint('user_preferences', __name__, url_prefix='/api/pref')

@bp.route('/<pref_id>', methods=['GET'])
@login_required
def get_user_preferences(pref_id: str):
    """
    Get a specific user preferences by ID
    ---
    tags:
      - UserPreferences
    parameters:
      - name: pref_id
        in: path
        type: string
        required: true
        description: The ID of the user preferences to retrieve
    responses:
      200:
        description: User preferences object
        schema:
          type: object
      404:
        description: User preferences not found
    """
    require_owns(pref_id)
    user = user_preferences_service.get_by_id(pref_id, as_dict=True)

    if not user:
        return jsonify({'error': 'User preferences not found'}), 404
    
    return jsonify(user)

@bp.route('/', methods=['POST'])
@login_required
def create_user_preferences():
    """
    Create user preferences
    ---
    tags:
      - UserPreferences
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            user_id:
              type: string
              example: "user_U0
            native_language_iso639_2:
              type: array
              items:
                type: string
                example: "eng"
            learning_goals:
              type: string
              example: "Improve vocabulary"
            preferred_exercise_types:
              type: array
              items:
                type: string
                example: "translate"
    responses:
        201:
            description: User preferences created successfully
            schema:
            type: object
        400:
            description: Invalid input data
    """
    try:
        # Validate request data
        data = UserPreferencesDict(**request.json)
        data.user_id = current_user_id()

        # Create user
        pref = user_preferences_service.create(data, as_dict=True)
        
        if pref:
            return jsonify({
                'success': True,
                'user_preferences': pref
            }), 201
        else:
            return jsonify({'error': 'Failed to create user preferences'}), 400
            
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': e.errors()}), 400
    
@bp.route('/<pref_id>', methods=['PUT', 'PATCH'])
@login_required
def update_user_preferences(pref_id: str):
    """Update a user preferences.
    ---
    tags:
      - UserPreferences
    parameters:
      - name: pref_id
        in: path
        type: string
        required: true
        description: The ID of the user preferences to update
      - name: body
        in: body
        required: true
        schema:
            type: object
            properties:
                user_id:
                    type: string
                    example: "user_U0"
                native_language_iso639_2:
                    type: array
                    items:
                        type: string
                        example: "eng"
                learning_goals:
                    type: string
                    example: "Improve vocabulary"
                preferred_exercise_types:
                    type: array
                    items:
                        type: string
                        example: "translate"
    responses:
      200:
        description: User preferences updated successfully
        schema:
          type: object
          schema:
            type: object
            properties:
                success:
                    type: boolean
                    example: true
                    description: Indicates if the update was successful
                user_preferences:
                    type: object
                    description: The updated user preferences object
      400:
        description: Validation failed
      404:
        description: User preferences not found
    """
    try:
        require_owns(pref_id)
        data = UserPreferencesDict(**request.json)

        pref = user_preferences_service.update(pref_id, data, as_dict=True)
        
        if pref:
            return jsonify({
                'success': True,
                'user_preferences': pref
            })
        else:
            return jsonify({'error': 'User preferences not found'}), 404
            
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': e.errors()}), 400
    
@bp.route('/<pref_id>', methods=['DELETE'])
@login_required
def delete_user_preferences(pref_id: str):
    """Delete a user preferences.
    ---
    tags:
      - UserPreferences
    parameters:
      - name: pref_id
        in: path
        type: string
        required: true
        description: The ID of the user preferences to delete
    responses:
        204:
            description: User preferences deleted successfully
        404:
            description: User preferences not found
    """
    require_owns(pref_id)
    success = user_preferences_service.delete(pref_id)

    if success:
        return jsonify({'success': True}), 204
    else:
        return jsonify({'error': 'User preferences not found'}), 404


@bp.route('/providers', methods=['GET'])
@login_required
def list_providers():
    """Return the provider catalog so the frontend stays in sync."""
    from ...utils.llm_providers import PROVIDER_LIST
    return jsonify(PROVIDER_LIST)


@bp.route('/test-endpoint', methods=['POST'])
@login_required
def test_endpoint():
    """Test connectivity to an API endpoint (server-side, no CORS).

    Branches on api_type:
      - tts:        POST /audio/speech probe
      - text_gen:   GET /models → mini chat completion (also used for ocr)
      - both:       TTS probe first, then text-gen; reports per-path status
    """
    import time

    import httpx

    from ...utils.model_api import chat_completion, ModelAPIError
    from ...utils.llm_providers import auth_headers

    _ERROR_MAP = {
        ModelAPIError.KIND_CONNECT: "Cannot reach server — check host and port, or disable HTTP_PROXY if a VPN/proxy is active",
        ModelAPIError.KIND_AUTH: "Authentication failed — check your API key",
        ModelAPIError.KIND_NOT_FOUND: "Endpoint not found — check the base URL path",
        ModelAPIError.KIND_SERVER: "Server error — the provider returned an internal error",
    }

    def _tts_probe(url: str) -> tuple[bool, str | None]:
        """POST /audio/speech — any HTTP response means reachable."""
        try:
            with httpx.Client(trust_env=False, timeout=8) as client:
                resp = client.post(url, json={"input": "test", "voice": "en_f"})
                return True, None
        except httpx.HTTPStatusError:
            return True, None  # 4xx/5xx still means server is reachable
        except Exception as e:
            try:
                err = ModelAPIError.from_connection(e, url=url)
                return False, _ERROR_MAP.get(err.kind, err.message)
            except Exception:
                return False, str(e)

    def _text_gen_probe() -> tuple[bool, str | None, list]:
        """GET /models + optional mini chat completion."""
        tg_url, tg_headers = auth_headers(f"{base_url.rstrip('/')}/models", api_key, auth_type)
        try:
            with httpx.Client(trust_env=False, timeout=8) as client:
                resp = client.get(tg_url, headers=tg_headers)
                resp.raise_for_status()
                models_data = resp.json()
                models = [m["id"] for m in models_data.get("data", [])]
        except Exception as e:
            return False, str(e), []

        if model:
            try:
                chat_completion(
                    base_url=base_url, api_key=api_key, model=model,
                    messages=[{"role": "user", "content": "hi"}],
                    max_tokens=5, api_format=api_format, auth_type=auth_type,
                )
            except Exception:
                pass  # /models passed, chat probe is optional
        return True, None, models

    body = request.json or {}
    base_url = (body.get("base_url") or "").strip()
    if not base_url:
        return jsonify({"ok": False, "error": "No base URL provided"}), 400

    model = (body.get("model") or "").strip()
    api_key = body.get("api_key") or ""
    api_format = body.get("api_format") or "openai"
    auth_type = body.get("auth_type") or "bearer"
    api_type = body.get("api_type") or "text_gen"

    start = time.perf_counter()

    # ── TTS / both: probe /audio/speech ──
    if api_type in ("tts", "both"):
        tts_url, tts_headers = auth_headers(f"{base_url.rstrip('/')}/audio/speech", api_key, auth_type)
        tts_url = f"{tts_url}"  # auth_headers may modify URL for param auth
        tts_ok, tts_error = _tts_probe(tts_url)
        ms = round((time.perf_counter() - start) * 1000)

        if api_type == "tts":
            if tts_ok:
                return jsonify({"ok": True, "ms": ms})
            return jsonify({"ok": False, "ms": ms, "error": tts_error})

        # api_type == "both"
        if tts_ok:
            tg_ok, tg_error, tg_models = _text_gen_probe()
            ms2 = round((time.perf_counter() - start) * 1000)
            return jsonify({
                "ok": True, "ms": ms2,
                "tts_ok": True, "text_gen_ok": tg_ok,
                "available_models": tg_models,
                **({"text_gen_error": tg_error} if tg_error else {}),
            })

        # TTS failed for "both" — try text-gen as fallback
        logger.info("TTS probe failed for 'both' endpoint (%s), trying text-gen fallback", tts_error)
        # Fall through to text-gen path below

    # ── Text-gen: GET /models → mini chat completion ──
    tg_ok, tg_error, tg_models = _text_gen_probe()
    ms = round((time.perf_counter() - start) * 1000)
    if tg_ok:
        return jsonify({"ok": True, "ms": ms, "available_models": tg_models})
    return jsonify({"ok": False, "ms": ms, "error": tg_error, "available_models": tg_models})