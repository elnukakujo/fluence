from flask import Blueprint, jsonify, request, g

from ...core.auth import login_required
from ...services.auth import AuthService, REMEMBER_DAYS

bp = Blueprint('auth', __name__, url_prefix='/api/auth')
auth_service = AuthService()


@bp.route('/login', methods=['POST'])
def login():
    """Email + password login; sets the session_token cookie."""
    data = request.json or {}
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""
    remember = bool(data.get("remember"))

    if not email:
        return jsonify({'error': 'Email is required'}), 400

    user, status = auth_service.authenticate(email, password)
    if status == "blocked":
        return jsonify({'error': 'account_blocked'}), 403
    if status == "locked":
        return jsonify({'error': 'account_locked'}), 403
    if status == "invalid":
        auth_service.on_failure(email)
        return jsonify({'error': 'Invalid email or password'}), 401
    if status == "needs_password":
        return jsonify({'needs_password': True, 'user_id': user.id}), 200

    auth_service.on_success(user.id)
    raw = auth_service.create_session(user.id, remember)
    resp = jsonify({'user': user.to_dict()})
    resp.set_cookie(
        'session_token', raw,
        httponly=True,
        samesite='Lax',
        # Mirror the actual connection, not the config: a Secure cookie is
        # dropped by browsers over plain HTTP, which logs everyone out. Behind a
        # TLS-terminating reverse proxy, add ProxyFix(x_proto=1) so
        # X-Forwarded-Proto makes is_secure True again.
        secure=request.is_secure,
        path='/',
        max_age=REMEMBER_DAYS * 86400 if remember else None,
    )
    return resp


@bp.route('/logout', methods=['POST'])
def logout():
    token = request.cookies.get('session_token')
    if token:
        auth_service.revoke(token)
    resp = jsonify({'success': True})
    resp.delete_cookie('session_token', path='/')
    return resp


@bp.route('/me', methods=['GET'])
@login_required
def me():
    user = getattr(g, 'current_user', None)
    if not user:
        return jsonify({'error': 'Authentication required'}), 401
    return jsonify({'user': user.to_dict()})
