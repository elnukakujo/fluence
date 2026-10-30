import json
from pathlib import Path

from flask import Blueprint, Response, current_app, jsonify, request

from ...core.auth import current_user_id, login_required, owner_user_id, require_write
from ...core.database import db_manager
from ...schemas.components import WordDict
from ...schemas.features import VocabularyDict
from ...schemas.system_data import SourceDict
from ...services import LessonService, VocabularyService
from ...services.ingestion.jobs import (IngestionJobService, candidates_path, job_dir, remove_job_files)
from ...services.ingestion.capabilities import capabilities, has_text_endpoint
from ...services.ingestion.preview import render_page_png
from ...services.parsing.pipeline import MAX_FILE_BYTES, _IMAGE_SUFFIXES
from ...services.system_data import SourceService, UserPreferencesService
from ...utils.llm_providers import resolve_api

bp = Blueprint("ingestion", __name__, url_prefix="/api/ingestion")
job_service = IngestionJobService()

_ALLOWED_SUFFIXES = _IMAGE_SUFFIXES | {".pdf"}
_CONFLICT_MODES = {"keep", "merge", "overwrite"}


def _public(job: dict) -> dict:
    return {k: v for k, v in job.items() if k not in ("file_path", "user_id")}


def _page_range(first, last):
    """(range, error): both bounds or neither; 1-based, last >= first."""
    first, last = (first or "").strip(), (last or "").strip()
    if not first and not last:
        return None, None
    if not (first.isdigit() and last.isdigit()):
        return None, "Give both the first and the last page as whole numbers"
    first, last = int(first), int(last)
    if first < 1 or last < first:
        return None, "The page range must start at 1 or later and end on or after its first page"
    return (first, last), None


def _owned_job_or_404(job_id: str):
    job = job_service.get(job_id, user_id=current_user_id())
    if job is None:
        return None, (jsonify({"error": "Job not found"}), 404)
    return job, None


@bp.route("/capabilities", methods=["GET"])
@login_required
def get_capabilities():
    """Whether the current user can import into a language/lesson, and why not.
    ---
    tags:
        - Ingestion
    parameters:
        - {name: language_id, in: query, type: string, required: true}
        - {name: lesson_id, in: query, type: string, required: false}
    responses:
        200: {description: "can_import, blocking reasons and non-blocking warnings"}
        400: {description: language_id missing}
        404: {description: Language not found}
    """
    language_id = (request.args.get("language_id") or "").strip()
    lesson_id = (request.args.get("lesson_id") or "").strip() or None
    if not language_id:
        return jsonify({"error": "language_id is required"}), 400
    if owner_user_id(language_id) is None or (lesson_id and owner_user_id(lesson_id) is None):
        return jsonify({"error": "Not found"}), 404
    return jsonify(capabilities(current_user_id(), language_id, lesson_id))


@bp.route("", methods=["GET"])
@login_required
def list_jobs():
    """My imports, newest first.
    ---
    tags:
        - Ingestion
    responses:
        200: {description: List of jobs}
    """
    return jsonify([_public(j) for j in job_service.list_for_user(current_user_id())])


@bp.route("/<job_id>/pages/<int:page>.png", methods=["GET"])
@login_required
def page_preview(job_id: str, page: int):
    """PNG of one page of the uploaded document (1-based).
    ---
    tags:
        - Ingestion
    parameters:
        - {name: job_id, in: path, type: string, required: true}
        - {name: page, in: path, type: integer, required: true}
    responses:
        200: {description: PNG image}
        404: {description: Not found, not yours, or no such page}
    """
    job, err = _owned_job_or_404(job_id)
    if err:
        return err
    png = render_page_png(Path(current_app.config["MEDIA_ROOT"]) / job["file_path"], page)
    if png is None:
        return jsonify({"error": "Page not found"}), 404
    return Response(png, mimetype="image/png", headers={"Cache-Control": "private, max-age=3600"})


@bp.route("", methods=["POST"])
@login_required
def upload():
    """Upload a PDF or image to be turned into vocabulary candidates.
    ---
    tags:
        - Ingestion
    consumes:
        - multipart/form-data
    parameters:
        - {name: file, in: formData, type: file, required: true}
        - {name: language_id, in: formData, type: string, required: true}
        - {name: lesson_id, in: formData, type: string, required: false}
        - {name: handwritten, in: formData, type: boolean, required: false}
        - {name: page_from, in: formData, type: integer, required: false}
        - {name: page_to, in: formData, type: integer, required: false}
    responses:
        202: {description: Job queued}
        400: {description: Invalid upload or no text-generation endpoint configured}
    """
    file = request.files.get("file")
    language_id = (request.form.get("language_id") or "").strip()
    lesson_id = (request.form.get("lesson_id") or "").strip() or None
    if not file or not file.filename or not language_id:
        return jsonify({"error": "file and language_id are required"}), 400
    if Path(file.filename).suffix.lower() not in _ALLOWED_SUFFIXES:
        return jsonify({"error": "Unsupported file type - upload a PDF or an image"}), 400
    if (request.content_length or 0) > MAX_FILE_BYTES + 1_000_000:
        return jsonify({"error": "File is too large"}), 400

    page_range, error = _page_range(request.form.get("page_from"), request.form.get("page_to"))
    if error:
        return jsonify({"error": error}), 400

    require_write(language_id)
    if lesson_id:
        require_write(lesson_id)
        lesson = LessonService().get_by_id(lesson_id, as_dict=True)
        if not lesson or lesson.get("language_id") != language_id:
            return jsonify({"error": "The lesson does not belong to that language"}), 400

    prefs = UserPreferencesService().get_by_user_id(current_user_id())
    if not has_text_endpoint(prefs):
        return jsonify({"error": "Add and activate a text-generation endpoint in Settings first - it is used to extract the vocabulary"}), 400

    handwritten = (request.form.get("handwritten") or "").lower() in ("1", "true", "on", "yes")
    job = job_service.create(current_user_id(), language_id, lesson_id, file.filename, handwritten,
                             page_from=page_range[0] if page_range else None,
                             page_to=page_range[1] if page_range else None)
    media_root = Path(current_app.config["MEDIA_ROOT"])
    try:
        job_dir(media_root, job["id"]).mkdir(parents=True, exist_ok=True)
        file.save(str(media_root / job["file_path"]))
    except OSError:
        remove_job_files(media_root, job["id"])
        job_service.delete(job["id"], current_user_id())
        return jsonify({"error": "Could not store the uploaded file"}), 500

    current_app.scheduler.schedule_ingestion(current_app._get_current_object(), job["id"])
    return jsonify({"job_id": job["id"], "status": job["status"]}), 202


@bp.route("/<job_id>", methods=["GET"])
@login_required
def get_job(job_id: str):
    """Status and progress of an ingestion job.
    ---
    tags:
        - Ingestion
    parameters:
        - {name: job_id, in: path, type: string, required: true}
    responses:
        200: {description: The job}
        404: {description: Not found (or not yours)}
    """
    job, err = _owned_job_or_404(job_id)
    return err if err else jsonify(_public(job))


@bp.route("/<job_id>/candidates", methods=["GET"])
@login_required
def get_candidates(job_id: str):
    """The vocabulary candidates (verified or flagged) found in the document.
    ---
    tags:
        - Ingestion
    parameters:
        - {name: job_id, in: path, type: string, required: true}
    responses:
        200: {description: candidates and warnings}
        409: {description: The job is not ready yet}
    """
    job, err = _owned_job_or_404(job_id)
    if err:
        return err
    if job["status"] != "ready":
        return jsonify({"error": f"Job is {job['status']}", "status": job["status"]}), 409
    path = candidates_path(current_app.config["MEDIA_ROOT"], job_id)
    if not path.is_file():
        return jsonify({"error": "Candidates are no longer available"}), 404
    return jsonify(json.loads(path.read_text()))


@bp.route("/<job_id>/accept", methods=["POST"])
@login_required
def accept(job_id: str):
    """Create Words and Vocabulary entries from the candidates the user kept.
    ---
    tags:
        - Ingestion
    parameters:
        - {name: job_id, in: path, type: string, required: true}
        - name: body
          in: body
          required: true
          schema:
              type: object
              properties:
                  lesson_id: {type: string}
                  items:
                      type: array
                      items:
                          type: object
                          properties:
                              word: {type: string}
                              translation: {type: string}
                              phonetic: {type: string}
                              word_type: {type: string}
                              on_conflict: {type: string, enum: [keep, merge, overwrite]}
    responses:
        200: {description: Entries created}
        400: {description: Invalid items or lesson}
    """
    job, err = _owned_job_or_404(job_id)
    if err:
        return err
    body = request.get_json(silent=True) or {}
    lesson_id = body.get("lesson_id") or job["lesson_id"]
    items = body.get("items")
    if not lesson_id or not isinstance(items, list) or not items:
        return jsonify({"error": "lesson_id and a non-empty items list are required"}), 400
    require_write(lesson_id)
    lesson = LessonService().get_by_id(lesson_id, as_dict=True)
    if not lesson or lesson.get("language_id") != job["language_id"]:
        return jsonify({"error": "The lesson does not belong to the document's language"}), 400

    for item in items:
        if not isinstance(item, dict) or not str(item.get("word") or "").strip():
            return jsonify({"error": "Every item needs a word"}), 400
        if item.get("on_conflict", "keep") not in _CONFLICT_MODES:
            return jsonify({"error": "on_conflict must be keep, merge or overwrite"}), 400

    vocabulary_service = VocabularyService()
    source_service = SourceService()
    created = 0
    with db_manager.session_scope() as session:   # one transaction: all or nothing
        source = _import_source(session, current_user_id(), job["filename"])
        for item in items:
            word = WordDict(
                word=str(item["word"]).strip(), translation=item.get("translation") or None,
                phonetic=item.get("phonetic") or None, word_type=item.get("word_type") or None,
            )
            vocabulary = vocabulary_service.create(VocabularyDict(lesson_id=lesson_id, word=word), session=session,
                                                   on_conflict=item.get("on_conflict", "keep"))
            if vocabulary:
                source_service.add_source_to_element(source.id, vocabulary.id, session=session)
                created += 1
    return jsonify({"created": created})


def _import_source(session, user_id: str, filename: str):
    """The user's "Imported from <file>" source, created on first use and reused after."""
    from ...models.system_data import Source
    title = f"Imported from {filename}"
    existing = session.query(Source).filter(Source.user_id == user_id, Source.title == title).first()
    if existing:
        return existing
    return SourceService().create(SourceDict(user_id=user_id, title=title, source_type="other"), session=session)


@bp.route("/<job_id>", methods=["DELETE"])
@login_required
def delete_job(job_id: str):
    """Delete a job and its uploaded file.
    ---
    tags:
        - Ingestion
    parameters:
        - {name: job_id, in: path, type: string, required: true}
    responses:
        204: {description: Deleted}
        404: {description: Not found (or not yours)}
    """
    job, err = _owned_job_or_404(job_id)
    if err:
        return err
    job_service.delete(job_id, current_user_id())
    remove_job_files(current_app.config["MEDIA_ROOT"], job_id)
    return "", 204
