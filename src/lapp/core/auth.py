from functools import wraps
from flask import g, jsonify, request, abort

from ..services.auth import AuthService

_auth_service = AuthService()


def init_auth(app):
    """Register the before_request hook that resolves the session cookie."""
    @app.before_request
    def load_current_user():
        g.current_user_id = None
        g.current_user = None
        token = request.cookies.get("session_token")
        if token:
            user = _auth_service.resolve(token)
            if user:
                g.current_user_id = user.id
                g.current_user = user


def current_user_id():
    return getattr(g, "current_user_id", None)


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if current_user_id() is None:
            return jsonify({"error": "Authentication required"}), 401
        return view(*args, **kwargs)
    return wrapped


def admin_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if current_user_id() is None:
            return jsonify({"error": "Authentication required"}), 401
        if not getattr(g.current_user, "is_admin", False):
            return jsonify({"error": "Admin access required"}), 403
        return view(*args, **kwargs)
    return wrapped


def require_owner(user_id: str) -> None:
    """Abort 403 when the given owning user_id isn't the current user."""
    if user_id != current_user_id():
        abort(403, description="Not your resource")
