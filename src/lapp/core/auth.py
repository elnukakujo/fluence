from functools import wraps
from flask import g, jsonify, request, abort

from ..services.auth import AuthService
from .database import db_manager

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


def owner_user_id(element_id: str):
    """Resolve the owning user_id for any element by its id prefix; None if not found."""
    from ..services import (
        LanguageService, LessonService,
        VocabularyService, GrammarService, CalligraphyService, ExerciseService,
        TagService, SourceService,
    )
    from ..services.system_data import UserPreferencesService
    from ..models.components import Word, Passage, Character

    if element_id.startswith("lang_"):
        lang = LanguageService().get_by_id(element_id, as_dict=True)
        return lang["user_id"] if lang else None
    if element_id.startswith("lesson_"):
        lesson = LessonService().get_by_id(element_id, as_dict=True)
        if not lesson:
            return None
        lang = LanguageService().get_by_id(lesson["language_id"], as_dict=True)
        return lang["user_id"] if lang else None
    for prefix, service in (
        ("voc_", VocabularyService()),
        ("gram_", GrammarService()),
        ("call_", CalligraphyService()),
        ("ex_", ExerciseService()),
    ):
        if element_id.startswith(prefix):
            feature = service.get_by_id(element_id, as_dict=True)
            if not feature:
                return None
            lesson = LessonService().get_by_id(feature["lesson_id"], as_dict=True)
            if not lesson:
                return None
            lang = LanguageService().get_by_id(lesson["language_id"], as_dict=True)
            return lang["user_id"] if lang else None
    for prefix, model in (("word_", Word), ("pass_", Passage), ("char_", Character)):
        if element_id.startswith(prefix):
            comp = db_manager.find_by_attr(model, {"id": element_id})
            if not comp:
                return None
            lang = LanguageService().get_by_id(comp.language_id, as_dict=True)
            return lang["user_id"] if lang else None
    if element_id.startswith("tag_"):
        tag = TagService().get_by_id(element_id, as_dict=True)
        return tag["user_id"] if tag else None
    if element_id.startswith("src_"):
        source = SourceService().get_by_id(element_id, as_dict=True)
        return source["user_id"] if source else None
    if element_id.startswith("pref_"):
        pref = UserPreferencesService().get_by_id(element_id, as_dict=True)
        return pref["user_id"] if pref else None
    return None


def require_owns(element_id: str) -> None:
    """404 if the element doesn't exist, 403 if it isn't the current user's."""
    owner = owner_user_id(element_id)
    if owner is None:
        abort(404, description="Not found")
    require_owner(owner)


def require_self_or_admin(user_id: str) -> None:
    """403 unless the current user is the target user or an admin."""
    if user_id != current_user_id() and not getattr(g.current_user, "is_admin", False):
        abort(403, description="Not your account")


def _resolve_containers(element_id: str):
    """Resolve (language_id, lesson_id) for a shareable element; (None, None) otherwise."""
    from ..services import (
        LanguageService, LessonService,
        VocabularyService, GrammarService, CalligraphyService, ExerciseService,
    )
    from ..models.components import Word, Passage, Character

    if element_id.startswith("lang_"):
        return element_id, None
    if element_id.startswith("lesson_"):
        lesson = LessonService().get_by_id(element_id, as_dict=True)
        return (lesson["language_id"], element_id) if lesson else (None, None)
    for prefix, service in (
        ("voc_", VocabularyService()), ("gram_", GrammarService()),
        ("call_", CalligraphyService()), ("ex_", ExerciseService()),
    ):
        if element_id.startswith(prefix):
            feature = service.get_by_id(element_id, as_dict=True)
            if not feature:
                return None, None
            lesson = LessonService().get_by_id(feature["lesson_id"], as_dict=True)
            return (lesson["language_id"], feature["lesson_id"]) if lesson else (None, None)
    for prefix, model in (("word_", Word), ("pass_", Passage), ("char_", Character)):
        if element_id.startswith(prefix):
            comp = db_manager.find_by_attr(model, {"id": element_id})
            return (comp.language_id, None) if comp else (None, None)
    return None, None


def can_write(user_id: str, element_id: str) -> bool:
    """True if `user_id` is the owner, an accepted collaborator, or a lesson-share recipient."""
    from ..services.system_data import CollaborationService, LessonShareService

    if owner_user_id(element_id) == user_id:
        return True
    language_id, lesson_id = _resolve_containers(element_id)
    collab_service = CollaborationService()
    if language_id and collab_service.is_collaborator(user_id, "language", language_id):
        return True
    if lesson_id and LessonShareService().is_recipient(user_id, lesson_id):
        return True
    return False


def require_write(element_id: str) -> None:
    """404 if absent, 403 if neither owner nor collaborator (write access)."""
    if owner_user_id(element_id) is None:
        abort(404, description="Not found")
    if not can_write(current_user_id(), element_id):
        abort(403, description="Not your resource")
