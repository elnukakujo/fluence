import logging
from collections import Counter

from flask import Blueprint, current_app, jsonify, request

from ...core.auth import current_user_id, login_required, require_write
from ...core.database import db_manager
from ...models.features import Exercise
from ...services import ExerciseService
from ...services.containers import LanguageService, LessonService
from ...services.exercise_generation import jobs
from ...services.exercise_generation.planner import plan_slots, suggest_count
from ...services.exercise_generation.pool import lesson_pool
from ...services.features.study_constants import GEN_MAX
from ...services.system_data import UserPreferencesService
from ...utils.llm_providers import resolve_api

logger = logging.getLogger(__name__)
bp = Blueprint("exercise_generation", __name__)


def _plan(lesson_id: str, count: int | None):
    """(pool, slots, count) for the current user; count None = the suggested one."""
    user_id = current_user_id()
    with db_manager.session_scope() as s:
        pool = lesson_pool(lesson_id, user_id, s)
        prefs = UserPreferencesService().get_by_user_id(user_id, session=s)
        tts = prefs.ai_tts_enabled is not False and resolve_api(prefs, "tts") is not None
        kinds = Counter(p.kind for p in pool)
        n = count if count is not None else suggest_count(kinds["vocabulary"], kinds["grammar"], kinds["calligraphy"])
        return pool, plan_slots(pool, n, prefs.exercise_type_prefs, tts), n


@bp.route("/api/lesson/<lesson_id>/exercises/suggest", methods=["GET"])
@login_required
def suggest(lesson_id: str):
    """Recommended number of exercises for a lesson and the planned mix of types.
    ---
    tags:
        - Exercise generation
    parameters:
        - {name: lesson_id, in: path, type: string, required: true}
    responses:
        200: {description: "{count, mix: {type: n}, pool: number of elements}"}
    """
    require_write(lesson_id)
    pool, slots, _ = _plan(lesson_id, None)
    return jsonify({"count": len(slots), "mix": dict(Counter(s.exercise_type for s in slots)), "pool": len(pool)})


@bp.route("/api/lesson/<lesson_id>/exercises/generate", methods=["POST"])
@login_required
def generate(lesson_id: str):
    """Start generating exercises for a lesson in the background.
    ---
    tags:
        - Exercise generation
    parameters:
        - {name: lesson_id, in: path, type: string, required: true}
    responses:
        202: {description: "{job_id}"}
        400: {description: count outside 1..60}
        409: {description: "text_gen_not_configured or empty_lesson"}
    """
    require_write(lesson_id)
    count = (request.get_json(silent=True) or {}).get("count")
    if not isinstance(count, int) or isinstance(count, bool) or not 1 <= count <= GEN_MAX:
        return jsonify({"error": f"count must be a whole number from 1 to {GEN_MAX}"}), 400
    api = resolve_api(UserPreferencesService().get_by_user_id(current_user_id()), "text_gen")
    if not api:
        return jsonify({"error": "text_gen_not_configured"}), 409
    pool, slots, _ = _plan(lesson_id, count)
    if not pool or not slots:
        return jsonify({"error": "empty_lesson"}), 409
    lesson = LessonService().get_by_id(lesson_id, as_dict=True)
    language = LanguageService().get_by_id(lesson["language_id"], as_dict=True)
    prefs = UserPreferencesService().get_by_user_id(current_user_id())
    source_iso = language.get("source_iso639_2t") or next(iter(prefs.native_language_iso639_2 or []), None)   # instructions go in the learner's own language
    source = jobs.target_name(source_iso) if source_iso else None
    job_id = jobs.start_job(current_app._get_current_object(), current_user_id(), lesson_id, count, api,
                            jobs.target_name(language.get("target_iso639_2t")), source if source != "the target language" else None)
    return jsonify({"job_id": job_id}), 202


@bp.route("/api/lesson/<lesson_id>/exercises/generate", methods=["GET"])
@login_required
def active(lesson_id: str):
    """The generation job left running (or just failed) for this lesson, so the page can show where it is at.
    ---
    tags:
        - Exercise generation
    parameters:
        - {name: lesson_id, in: path, type: string, required: true}
    responses:
        200: {description: "{job_id, state, done, total[, error]} or null"}
    """
    return jsonify(jobs.active_job(current_user_id(), lesson_id))


@bp.route("/api/exercise-generation/<job_id>", methods=["GET"])
@login_required
def progress(job_id: str):
    """Progress of a generation job: {state: running|done|failed, done, total[, result, error]}.
    ---
    tags:
        - Exercise generation
    parameters:
        - {name: job_id, in: path, type: string, required: true}
    responses:
        200: {description: the job}
        404: {description: unknown job (also after a server restart)}
    """
    job = jobs.get_job(job_id, current_user_id())
    return (jsonify(job), 200) if job else (jsonify({"error": "Unknown job"}), 404)


@bp.route("/api/exercise-batch/<batch_id>", methods=["DELETE"])
@login_required
def undo_batch(batch_id: str):
    """Delete every exercise of one generation batch.
    ---
    tags:
        - Exercise generation
    parameters:
        - {name: batch_id, in: path, type: string, required: true}
    responses:
        200: {description: "{deleted: n}"}
    """
    with db_manager.session_scope() as s:
        exercises = s.query(Exercise).filter(Exercise.generation_batch_id == batch_id).all()
        for lesson_id in {e.lesson_id for e in exercises}:
            require_write(lesson_id)
        service = ExerciseService()
        for e in exercises:
            service.delete(e.id, session=s)
        return jsonify({"deleted": len(exercises)})
