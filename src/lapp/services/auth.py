from datetime import datetime, timedelta
import hashlib
import secrets
from typing import Optional
from sqlalchemy.orm import Session

from werkzeug.security import check_password_hash

from ..core.database import db_manager, transactional
from ..models.system_data import User, UserSession

# Login throttling: lock an account after N failed attempts.
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15
REMEMBER_DAYS = 365


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class AuthService:
    """Session + login auth. Tokens are never stored raw — only SHA-256 hashes."""

    @transactional
    def authenticate(
        self,
        email: str,
        password: str,
        session: Optional[Session] = None,
    ) -> tuple[Optional[User], Optional[str]]:
        """Verify an email/password pair.

        Returns (user, status): user is None on failure; status is None on
        success, else one of "invalid", "blocked", "locked", "needs_password".
        The blocked check precedes password verification (family scope: tell
        the user their account is blocked regardless of the password).
        """
        user = db_manager.find_by_attr(User, {"email": email}, session=session)
        if not user:
            return None, "invalid"
        if user.blocked:
            return None, "blocked"
        if user.locked_until and user.locked_until > datetime.now():
            return None, "locked"
        if not user.password_hash:
            return user, "needs_password"
        if not check_password_hash(user.password_hash, password):
            return None, "invalid"
        return user, None

    @transactional
    def create_session(
        self,
        user_id: str,
        remember: bool,
        session: Optional[Session] = None,
    ) -> str:
        """Create a session row; returns the raw token (only the hash is stored)."""
        raw = secrets.token_urlsafe(32)
        expires_at = datetime.now() + timedelta(days=REMEMBER_DAYS) if remember else None
        db_manager.insert(
            UserSession(
                id=db_manager.generate_new_id(UserSession, session=session),
                user_id=user_id,
                token_hash=_hash(raw),
                expires_at=expires_at,
            ),
            session=session,
            commit=False,
        )
        return raw

    @transactional
    def resolve(self, raw_token: str, session: Optional[Session] = None) -> Optional[User]:
        sess = db_manager.find_by_attr(UserSession, {"token_hash": _hash(raw_token)}, session=session)
        if not sess:
            return None
        if sess.expires_at and sess.expires_at < datetime.now():
            return None
        user = db_manager.find_by_attr(User, {"id": sess.user_id}, session=session)
        if not user or user.blocked:
            return None
        return user

    @transactional
    def revoke(self, raw_token: str, session: Optional[Session] = None) -> None:
        sess = db_manager.find_by_attr(UserSession, {"token_hash": _hash(raw_token)}, session=session)
        if sess:
            db_manager.delete(sess, session=session, commit=False)

    @transactional
    def on_failure(self, email: str, session: Optional[Session] = None) -> bool:
        """Record a failed login; returns True when the account just locked."""
        user = db_manager.find_by_attr(User, {"email": email}, session=session)
        if not user:
            return False
        user.failed_login_count += 1
        if user.failed_login_count >= MAX_FAILED_ATTEMPTS:
            user.locked_until = datetime.now() + timedelta(minutes=LOCKOUT_MINUTES)
            user.failed_login_count = 0
            return True
        return False

    @transactional
    def on_success(self, user_id: str, session: Optional[Session] = None) -> None:
        user = db_manager.find_by_attr(User, {"id": user_id}, session=session)
        if not user:
            return
        user.failed_login_count = 0
        user.locked_until = None
        user.last_login_at = datetime.now()
