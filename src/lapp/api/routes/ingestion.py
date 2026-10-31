import json
from pathlib import Path

from flask import Blueprint, Response, current_app, jsonify, request

from ...core.auth import current_user_id, login_required, owner_user_id, require_write
from ...core.database import db_manager
from ...schemas.components import WordDict
from ...schemas.containers import LessonDict
from ...schemas.features import VocabularyDict
from ...schemas.system_data import SourceDict
from ...services import LessonService, VocabularyService
from ...services.components import PassageService, CharacterService
from ...services.features import GrammarService
from ...services.ingestion.jobs import (IngestionJobService, candidates_path, created_lesson_path, job_dir,
                                        remove_job_files)
from ...services.ingestion.classify import validate_page_kinds
from ...services.ingestion.structure import validate_structure
from ...services.ingestion.capabilities import capabilities, has_text_endpoint
from ...services.ingestion.preview import render_page_png
from ...services.parsing.pipeline import MAX_FILE_BYTES, _IMAGE_SUFFIXES
from ...services.system_data import SourceService, UserPreferencesService
from ...utils.llm_providers import resolve_api
from ...schemas.components import PassageDict, CharacterDict
from ...schemas.features import GrammarDict

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
    if job["lesson_id"] is None:
        return _language_candidates(job)
    if job["status"] != "ready":
        return jsonify({"error": f"Job is {job['status']}", "status": job["status"]}), 409
    path = candidates_path(current_app.config["MEDIA_ROOT"], job_id)
    if not path.is_file():
        return jsonify({"error": "Candidates are no longer available"}), 404
    return jsonify(json.loads(path.read_text()))


def _lessons_view(job: dict, with_candidates: bool = False) -> list[dict]:
    """The structure's lessons, plus the id of the Lesson created on accept and (optionally) their candidates."""
    media_root = current_app.config["MEDIA_ROOT"]
    out = []
    for lesson in (job["structure"] or {}).get("lessons", []):
        item = dict(lesson)
        created = created_lesson_path(media_root, job["id"], lesson["index"])
        item["created_lesson_id"] = created.read_text().strip() if created.is_file() else None
        if with_candidates and lesson["status"] == "done":
            path = candidates_path(media_root, job["id"], lesson["index"])
            item["candidates"] = json.loads(path.read_text())["candidates"] if path.is_file() else []
        out.append(item)
    return out


def _language_candidates(job: dict):
    structure = job["structure"]
    if not structure or not structure.get("confirmed") or job["status"] not in ("extracting", "ready"):
        return jsonify({"error": f"Job is {job['status']}", "status": job["status"]}), 409
    return jsonify({"status": job["status"], "lessons": _lessons_view(job, with_candidates=True),
                    "warnings": job["warnings"]})


@bp.route("/<job_id>/structure", methods=["GET"])
@login_required
def get_structure(job_id: str):
    """The proposed (or confirmed) lessons of a language-level import.
    ---
    tags:
        - Ingestion
    parameters:
        - {name: job_id, in: path, type: string, required: true}
    responses:
        200: {description: "confirmed, first_page, last_page, lessons"}
        409: {description: The lessons have not been proposed yet}
    """
    job, err = _owned_job_or_404(job_id)
    if err:
        return err
    if not job["structure"]:
        return jsonify({"error": f"Job is {job['status']}", "status": job["status"]}), 409
    s = job["structure"]
    return jsonify({"status": job["status"], "confirmed": s["confirmed"], "first_page": s["first_page"],
                    "last_page": s["last_page"], "lessons": _lessons_view(job), "page_kinds": job["page_kinds"],
                    "warnings": job["warnings"]})


@bp.route("/<job_id>/structure", methods=["POST"])
@login_required
def confirm_structure(job_id: str):
    """Confirm (after editing) the lessons to extract; starts the per-lesson extraction.
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
                  lessons:
                      type: array
                      items:
                          type: object
                          properties:
                              title: {type: string}
                              start_page: {type: integer}
                              end_page: {type: integer}
                  page_kinds:
                      type: object
                      description: "optional {page: [kind, ...]}; pages left out keep their stored kinds"
    responses:
        200: {description: Extraction started}
        400: {description: Invalid lessons}
        409: {description: Not awaiting confirmation}
    """
    job, err = _owned_job_or_404(job_id)
    if err:
        return err
    if job["lesson_id"] is not None:
        return jsonify({"error": "This import targets a single lesson"}), 400
    if job["status"] != "structure" or not job["structure"] or job["structure"]["confirmed"]:
        return jsonify({"error": "The lessons were already confirmed or are not ready yet"}), 409
    old = job["structure"]
    body = request.get_json(silent=True) or {}
    clean, error = validate_structure(body.get("lessons"), old["first_page"], old["last_page"])
    if error:
        return jsonify({"error": error}), 400
    fields = {}
    if "page_kinds" in body:
        kinds, error = validate_page_kinds(body["page_kinds"], old["first_page"], old["last_page"], job["page_kinds"])
        if error:
            return jsonify({"error": error}), 400
        fields["page_kinds"] = {str(n): k for n, k in kinds.items()}
    lessons = [{**c, "index": i, "verified": None, "note": None, "status": "pending", "error": None, "counts": None}
               for i, c in enumerate(clean)]
    job_service.update(job_id, status="extracting", pages_done=0, pages_total=len(lessons),
                       structure={**old, "confirmed": True, "lessons": lessons}, **fields)
    current_app.scheduler.schedule_extraction(current_app._get_current_object(), job_id)
    return jsonify({"status": "extracting", "lessons": len(lessons)})


@bp.route("/<job_id>/pages", methods=["GET"])
@login_required
def get_pages(job_id: str):
    """The kinds of content found on each page of a lesson-level import, awaiting confirmation.
    ---
    tags:
        - Ingestion
    parameters:
        - {name: job_id, in: path, type: string, required: true}
    responses:
        200: {description: "status, page_kinds ({page: [kind]}), first_page, last_page, warnings"}
        409: {description: The pages have not been classified yet (status other than pages)}
    """
    job, err = _owned_job_or_404(job_id)
    if err:
        return err
    if job["status"] != "pages":
        return jsonify({"error": f"Job is {job['status']}", "status": job["status"]}), 409
    first, last = _page_bounds(job)
    return jsonify({"status": job["status"], "page_kinds": job["page_kinds"], "first_page": first,
                    "last_page": last, "warnings": job["warnings"]})


def _page_bounds(job: dict) -> tuple[int, int]:
    pages = [int(p) for p in job["page_kinds"] or {}]
    return min(pages, default=1), max(pages, default=0)


@bp.route("/<job_id>/pages", methods=["POST"])
@login_required
def confirm_pages(job_id: str):
    """Confirm (after editing) which kinds of content to extract per page; starts the extraction.
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
                  page_kinds:
                      type: object
                      description: "{page: [kind, ...]} with kinds from vocabulary, grammar, passage, character; pages left out keep their classified kinds"
    responses:
        200: {description: Extraction started}
        400: {description: Invalid page_kinds}
        409: {description: Not awaiting confirmation}
    """
    job, err = _owned_job_or_404(job_id)
    if err:
        return err
    if job["lesson_id"] is None:
        return jsonify({"error": "This import covers a whole language - confirm the lessons instead"}), 400
    if job["status"] != "pages":
        return jsonify({"error": "The pages were already confirmed or are not ready yet"}), 409
    first, last = _page_bounds(job)
    kinds, error = validate_page_kinds((request.get_json(silent=True) or {}).get("page_kinds"), first, last,
                                       job["page_kinds"])
    if error:
        return jsonify({"error": error}), 400
    job_service.update(job_id, status="extracting", pages_done=0, pages_total=len(kinds),
                       page_kinds={str(n): k for n, k in kinds.items()})
    current_app.scheduler.schedule_extraction(current_app._get_current_object(), job_id)
    return jsonify({"status": "extracting"})


@bp.route("/<job_id>/lessons/<int:index>/accept", methods=["POST"])
@login_required
def accept_lesson(job_id: str, index: int):
    """Create the lesson (once) and its vocabulary from the items the user kept for one proposed lesson.
    ---
    tags:
        - Ingestion
    parameters:
        - {name: job_id, in: path, type: string, required: true}
        - {name: index, in: path, type: integer, required: true}
        - name: body
          in: body
          required: true
          schema:
              type: object
              properties:
                  title: {type: string}
                  items: {type: array, items: {type: object}}
                  elements: {type: array, items: {type: object}}
    responses:
        200: {description: "lesson_id, created and created_elements"}
        400: {description: Invalid items or elements}
        404: {description: Unknown job or lesson}
        409: {description: The lesson is not finished}
    """
    job, err = _owned_job_or_404(job_id)
    if err:
        return err
    if job["lesson_id"] is not None:
        return jsonify({"error": "This import targets a single lesson - use /accept"}), 400
    structure = job["structure"]
    if not structure or not structure["confirmed"]:
        return jsonify({"error": "Confirm the lessons first"}), 409
    if not 0 <= index < len(structure["lessons"]):
        return jsonify({"error": "Lesson not found"}), 404
    lesson = structure["lessons"][index]
    if lesson["status"] != "done":
        return jsonify({"error": f"This lesson is {lesson['status']}"}), 409
    body = request.get_json(silent=True) or {}
    items = body.get("items")
    elements = body.get("elements", [])
    if not isinstance(items, list) or not items:
        return jsonify({"error": "A non-empty items list is required"}), 400
    if error := _invalid_items(items):
        return jsonify({"error": error}), 400
    if isinstance(elements, list):
        if error := _invalid_elements(elements):
            return jsonify({"error": error}), 400
    require_write(job["language_id"])

    created_file = created_lesson_path(current_app.config["MEDIA_ROOT"], job_id, index)
    with db_manager.session_scope() as session:   # lesson + vocabulary in one transaction
        lesson_id = created_file.read_text().strip() if created_file.is_file() else None
        if not lesson_id or not LessonService().get_by_id(lesson_id, session=session):
            created = LessonService().create(LessonDict(
                title=(body.get("title") or lesson["title"]).strip(), language_id=job["language_id"],
                user_id=owner_user_id(job["language_id"])), session=session)
            lesson_id = created.id
        added = _add_vocabulary(session, job, lesson_id, items)
        added_elements = _add_elements(session, job, lesson_id, job["language_id"], elements)
    created_file.parent.mkdir(parents=True, exist_ok=True)
    created_file.write_text(lesson_id)
    return jsonify({"lesson_id": lesson_id, "created": added, "created_elements": added_elements})


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
                  elements:
                      type: array
                      items:
                          type: object
                          properties:
                              kind: {type: string, enum: [passage, grammar, character]}
                              fields: {type: object}
    responses:
        200: {description: Entries created}
        400: {description: Invalid items, elements or lesson}
    """
    job, err = _owned_job_or_404(job_id)
    if err:
        return err
    body = request.get_json(silent=True) or {}
    lesson_id = body.get("lesson_id") or job["lesson_id"]
    items = body.get("items")
    elements = body.get("elements", [])
    # Need lesson_id and (items list OR elements list), but at least one must be non-empty
    if not lesson_id:
        return jsonify({"error": "lesson_id is required"}), 400
    if not isinstance(items, list) and not isinstance(elements, list):
        return jsonify({"error": "lesson_id and a non-empty items list are required"}), 400
    # At least one of items or elements must be non-empty
    if (not items or not isinstance(items, list)) and not elements:
        return jsonify({"error": "lesson_id and a non-empty items list are required"}), 400

    require_write(lesson_id)
    lesson = LessonService().get_by_id(lesson_id, as_dict=True)
    if not lesson or lesson.get("language_id") != job["language_id"]:
        return jsonify({"error": "The lesson does not belong to the document's language"}), 400

    if isinstance(items, list):
        if error := _invalid_items(items):
            return jsonify({"error": error}), 400

    if isinstance(elements, list):
        if error := _invalid_elements(elements):
            return jsonify({"error": error}), 400

    with db_manager.session_scope() as session:   # one transaction: all or nothing
        created = _add_vocabulary(session, job, lesson_id, items)
        created_elements = _add_elements(session, job, lesson_id, job["language_id"], elements)
    return jsonify({"created": created, "created_elements": created_elements})


def _invalid_items(items) -> str | None:
    for item in items:
        if not isinstance(item, dict) or not str(item.get("word") or "").strip():
            return "Every item needs a word"
        if item.get("on_conflict", "keep") not in _CONFLICT_MODES:
            return "on_conflict must be keep, merge or overwrite"
    return None


def _add_vocabulary(session, job: dict, lesson_id: str, items: list) -> int:
    """Create Word + Vocabulary for each item in `lesson_id`, tagged with the import's Source."""
    vocabulary_service, source_service = VocabularyService(), SourceService()
    source = _import_source(session, current_user_id(), job["filename"])
    created = 0
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
    return created


def _import_source(session, user_id: str, filename: str):
    """The user's "Imported from <file>" source, created on first use and reused after."""
    from ...models.system_data import Source
    title = f"Imported from {filename}"
    existing = session.query(Source).filter(Source.user_id == user_id, Source.title == title).first()
    if existing:
        return existing
    return SourceService().create(SourceDict(user_id=user_id, title=title, source_type="other"), session=session)


def _invalid_elements(elements) -> str | None:
    """Validate element structure before creation. Returns error string or None."""
    for elem in elements:
        if not isinstance(elem, dict):
            return "Every element must be an object"
        kind = elem.get("kind")
        if kind not in ("passage", "grammar", "character"):
            return f"Element kind must be passage, grammar or character, got: {kind}"
        fields = elem.get("fields")
        if not isinstance(fields, dict):
            return "Every element needs a fields dict"
        # Check required fields per kind
        if kind == "passage":
            if not isinstance(fields.get("text"), str) or not str(fields.get("text", "")).strip():
                return "Passage requires a non-empty text field"
        elif kind == "grammar":
            if not isinstance(fields.get("title"), str) or not str(fields.get("title", "")).strip():
                return "Grammar requires a non-empty title field"
            if not isinstance(fields.get("explanation"), str) or not str(fields.get("explanation", "")).strip():
                return "Grammar requires a non-empty explanation field"
        elif kind == "character":
            if not isinstance(fields.get("character"), str) or not str(fields.get("character", "")).strip():
                return "Character requires a non-empty character field"
    return None


def _normalize_text(text: str) -> str:
    """Normalize text for matching (whitespace, case)."""
    return " ".join(str(text).split()).lower()


def _add_elements(session, job: dict, lesson_id: str, language_id: str, elements: list) -> int:
    """Create passages, grammar and characters for each element, tagged with import source."""
    if not isinstance(elements, list):
        return 0

    passage_service = PassageService()
    grammar_service = GrammarService()
    character_service = CharacterService()
    source_service = SourceService()
    source = _import_source(session, current_user_id(), job["filename"])

    created = 0
    # First pass: collect created passages for grammar linking
    created_passages = {}  # normalized_text -> passage object

    for elem in elements:
        kind = elem.get("kind")
        fields = elem.get("fields", {})

        if kind == "passage":
            text = str(fields.get("text", "")).strip()
            passage = passage_service.get_by_text(text, language_id=language_id, session=session)
            if not passage:
                passage_dict = PassageDict(
                    text=text,
                    translation=fields.get("translation") or None,
                    language_id=language_id,
                )
                passage = passage_service.create(passage_dict, session=session)
                if passage:
                    source_service.add_source_to_element(source.id, passage.id, session=session)
                    created += 1
                    created_passages[_normalize_text(text)] = passage
            else:
                created_passages[_normalize_text(text)] = passage

        elif kind == "grammar":
            title = str(fields.get("title", "")).strip()
            # Check if grammar with this title already exists in the lesson
            from ...models.features import Grammar
            existing = session.query(Grammar).filter(
                Grammar.lesson_id == lesson_id,
                Grammar.title == title
            ).first()
            if not existing:
                example_sentences = []
                for sent_text in (fields.get("example_sentences") or []):
                    sent_text = str(sent_text).strip()
                    if not sent_text:
                        continue
                    # Link to passage if it matches one in this request; otherwise ignore
                    norm_sent = _normalize_text(sent_text)
                    if norm_sent in created_passages:
                        example_sentences.append(created_passages[norm_sent])

                grammar_dict = GrammarDict(
                    lesson_id=lesson_id,
                    title=title,
                    explanation=str(fields.get("explanation", "")).strip(),
                    example_sentences=[PassageDict(
                        text=p.text,
                        translation=p.translation,
                        language_id=language_id
                    ) for p in example_sentences] if example_sentences else None
                )
                grammar = grammar_service.create(grammar_dict, session=session)
                if grammar:
                    source_service.add_source_to_element(source.id, grammar.id, session=session)
                    created += 1

        elif kind == "character":
            character = str(fields.get("character", "")).strip()
            existing = character_service.get_by_character(character, language_id=language_id, session=session)
            if not existing:
                character_dict = CharacterDict(
                    character=character,
                    phonetic=fields.get("phonetic") or None,
                    meaning=fields.get("meaning") or None,
                    radical=fields.get("radical") or None,
                    strokes=fields.get("strokes") or None,
                    language_id=language_id,
                )
                created_char = character_service.create(character_dict, session=session, on_conflict="keep")
                if created_char:
                    source_service.add_source_to_element(source.id, created_char.id, session=session)
                    created += 1

    return created


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
