"""Ingestion jobs: the DB row, the on-disk files, and the background runner."""
import json
import logging
import re
import shutil
import time
from pathlib import Path
from typing import Optional

from flask import Flask, current_app
from sqlalchemy.orm import Session

from ...core.database import db_manager, transactional
from ...models.features import Calligraphy, Vocabulary
from ...models.system_data import IngestionJob
from ...utils.llm_providers import resolve_api
from ...utils.model_api import ModelAPIError
from ...utils.detect_language import get_language_by_iso2t
from ..parsing import ParseError, parse, remote_engine_for
from ..parsing.types import Document, ParseCancelled
from .classify import classify_pages
from .extract import ExtractionError
from .pipeline import build_candidates
from .structure import _ABORT_KINDS, lesson_ranges, pages_in_ranges, propose_structure
from .types import ALL_KINDS

logger = logging.getLogger(__name__)

_UNSAFE = re.compile(r"[^A-Za-z0-9._-]+")


def safe_filename(name: str) -> str:
    """Keep only a plain, short file name (no directories, no odd characters)."""
    base = _UNSAFE.sub("_", Path(name or "upload").name).strip("._") or "upload"
    suffix = Path(base).suffix[:10]
    return base[:80 - len(suffix)] + suffix if len(base) > 80 else base


def job_dir(media_root: str | Path, job_id: str) -> Path:
    return Path(media_root) / "ingestion" / job_id


def candidates_path(media_root: str | Path, job_id: str, lesson_index: Optional[int] = None) -> Path:
    """candidates.json (lesson-level) or candidates-<i>.json (one per lesson of a language-level import)."""
    name = "candidates.json" if lesson_index is None else f"candidates-{lesson_index}.json"
    return job_dir(media_root, job_id) / name


def document_path(media_root: str | Path, job_id: str) -> Path:
    """The parsed Document, kept so the later steps of a language-level import never re-parse."""
    return job_dir(media_root, job_id) / "document.json"


def created_lesson_path(media_root: str | Path, job_id: str, lesson_index: int) -> Path:
    """Holds the id of the Lesson created when a proposed lesson was accepted (owned by the accept route)."""
    return job_dir(media_root, job_id) / f"lesson-{lesson_index}.txt"


def paused_path(media_root: str | Path, job_id: str) -> Path:
    """Exists while the user has the import paused (a marker file, so no schema change)."""
    return job_dir(media_root, job_id) / "paused"


class IngestionJobService:
    @transactional
    def create(self, user_id: str, language_id: str, lesson_id: Optional[str], filename: str,
               handwritten: bool = False, page_ranges: Optional[list] = None,
               source_title: Optional[str] = None, source_type: Optional[str] = None,
               source_description: Optional[str] = None, level: Optional[int] = None,
               session: Optional[Session] = None) -> dict:
        job_id = db_manager.generate_new_id(IngestionJob, session=session)
        job = IngestionJob(
            id=job_id, user_id=user_id, language_id=language_id, lesson_id=lesson_id,
            filename=filename, file_path=f"ingestion/{job_id}/{safe_filename(filename)}",
            handwritten=handwritten, page_ranges=page_ranges, status="queued", warnings=[],
            source_title=source_title, source_type=source_type, source_description=source_description, level=level,
        )
        session.add(job)
        session.flush()
        return job.to_dict()

    @transactional
    def get(self, job_id: str, user_id: Optional[str] = None, session: Optional[Session] = None) -> dict | None:
        """The job as a dict; with `user_id`, only if that user owns it (others get None -> 404)."""
        job = session.get(IngestionJob, job_id)
        if job is None or (user_id is not None and job.user_id != user_id):
            return None
        return job.to_dict()

    @transactional
    def list_for_user(self, user_id: str, limit: int = 50, session: Optional[Session] = None) -> list[dict]:
        rows = (session.query(IngestionJob).filter(IngestionJob.user_id == user_id)
                .order_by(IngestionJob.created_at.desc(), IngestionJob.id.desc()).limit(limit).all())
        return [r.to_dict() for r in rows]

    @transactional
    def update(self, job_id: str, session: Optional[Session] = None, **fields) -> None:
        job = session.get(IngestionJob, job_id)
        if job is not None:
            for key, value in fields.items():
                setattr(job, key, value)
            session.flush()

    @transactional
    def delete(self, job_id: str, user_id: str, session: Optional[Session] = None) -> bool:
        job = session.get(IngestionJob, job_id)
        if job is None or job.user_id != user_id:
            return False
        session.delete(job)
        session.flush()
        return True

    @transactional
    def fail_interrupted(self, session: Optional[Session] = None) -> int:
        """At server start, jobs still parsing/extracting died with the previous process.
        Jobs waiting on the user (`pages`, `structure`) survive a restart: their document is on disk."""
        jobs = session.query(IngestionJob).filter(IngestionJob.status.in_(["parsing", "extracting"])).all()
        for job in jobs:
            job.status, job.error = "failed", "Interrupted by a server restart - please upload again"
        session.flush()
        return len(jobs)

    @transactional
    def queued_ids(self, session: Optional[Session] = None) -> list[str]:
        """Jobs that were waiting for the single worker, oldest first. The executor queue is in memory, so at server
        start these must be scheduled again or they would wait forever."""
        rows = session.query(IngestionJob.id).filter(IngestionJob.status == "queued").order_by(IngestionJob.created_at).all()
        return [job_id for (job_id,) in rows]


def remove_job_files(media_root: str | Path, job_id: str) -> None:
    shutil.rmtree(job_dir(media_root, job_id), ignore_errors=True)


def run_ingestion_job(app: Flask, job_id: str) -> None:
    """Background entry point. Parse -> classify the pages -> wait for the user (status `pages` for a lesson,
    `structure` for a language, which also proposes the lessons). Never raises."""
    _guarded(app, job_id, _run)


def run_language_extraction(app: Flask, job_id: str) -> None:
    """Second background step, scheduled once the user confirmed the pages' kinds (lesson-level) or the
    lessons (language-level)."""
    _guarded(app, job_id, _run_extraction)


class Stopped(ParseCancelled):
    """The user pressed Stop: the job was marked failed ("Stopped by you.") while this worker was still on it."""


def check_alive(svc: IngestionJobService, job_id: str) -> None:
    """Called between pages / chunks / lessons, so a stop takes effect before the next model call is paid for."""
    job = svc.get(job_id)
    if job is None or job["status"] == "failed":
        raise Stopped
    # ponytail: a paused job waits here and holds the single ingest worker; give pause its own resumable
    # step (or more workers) if paused imports ever starve other users' jobs.
    paused = paused_path(current_app.config["MEDIA_ROOT"], job_id)
    while paused.is_file():
        time.sleep(1)
        job = svc.get(job_id)
        if job is None or job["status"] == "failed":
            raise Stopped


def _progress(svc: IngestionJobService, job_id: str):
    def tick(done: int, total: int) -> None:
        check_alive(svc, job_id)
        svc.update(job_id, pages_done=done, pages_total=total)
    return tick


def _guarded(app: Flask, job_id: str, step) -> None:
    with app.app_context():
        svc = IngestionJobService()
        try:
            check_alive(svc, job_id)
            step(app, svc, job_id)
        except Stopped:
            logger.info("Ingestion job %s stopped by the user", job_id)
        except ParseError as e:
            svc.update(job_id, status="failed", error=f"{e.code}: {e}")
        except (ExtractionError, ModelAPIError) as e:
            svc.update(job_id, status="failed", error=f"Extraction failed: {e}")
        except Exception:
            logger.exception("Ingestion job %s crashed", job_id)
            svc.update(job_id, status="failed", error="Unexpected error while processing the document")


class _Ctx:
    """Everything a job step needs, resolved once from the owner's settings."""
    def __init__(self, job, media_root, text_api, remote, target, source, warnings):
        self.job, self.media_root, self.text_api, self.remote = job, media_root, text_api, remote
        self.target, self.source, self.warnings = target, source, warnings


def _prepare(app: Flask, svc: IngestionJobService, job_id: str) -> Optional[_Ctx]:
    """Resolve settings; mark the job failed and return None when it cannot run."""
    from ..containers import LanguageService
    from ..system_data import UserPreferencesService

    job = svc.get(job_id)
    if job is None:
        return None
    prefs = UserPreferencesService().get_by_user_id(job["user_id"])
    text_api = resolve_api(prefs, "text_gen") if prefs else None
    if not text_api:
        svc.update(job_id, status="failed", error="No text-generation endpoint is configured in your settings")
        return None
    warnings: list[str] = []
    remote = None
    if ocr_api := (resolve_api(prefs, "ocr") if prefs else None):
        try:
            remote = remote_engine_for(ocr_api)
        except ParseError as e:
            warnings.append(f"Vision OCR endpoint ignored: {e}")
    language = LanguageService().get_by_id(job["language_id"], as_dict=True, include_relations=False)
    if not language:
        svc.update(job_id, status="failed", error="The language no longer exists")
        return None
    return _Ctx(job, Path(app.config["MEDIA_ROOT"]), text_api, remote,
                language.get("target_iso639_2t"), language.get("source_iso639_2t"), warnings)


def _parse_job(svc: IngestionJobService, ctx: _Ctx) -> Document:
    job_id = ctx.job["id"]
    svc.update(job_id, status="parsing", pages_done=0, pages_total=0)
    job = ctx.job
    return parse(ctx.media_root / job["file_path"], target_iso639_2t=ctx.target, source_iso639_2t=ctx.source,
                 remote=ctx.remote, handwritten=job["handwritten"], cache_dir=ctx.media_root / "parse_cache",
                 pages=[tuple(r) for r in job["page_ranges"]] if job["page_ranges"] else None,
                 progress=_progress(svc, job_id))


def _lookup_for(job: dict):
    """word -> "lesson" | "language" | None, for the already_in_* notes."""
    from ..components import WordService
    word_service = WordService()

    def lookup(w: str):
        word = word_service.get_by_word(w, language_id=job["language_id"])
        if word is None:
            return None
        if job["lesson_id"]:
            with db_manager.session_scope() as s:
                if s.query(Vocabulary).filter(Vocabulary.word_id == word.id,
                                              Vocabulary.lesson_id == job["lesson_id"]).first():
                    return "lesson"
        return "language"
    return lookup


def _attach_existing(job: dict, result) -> None:
    """Show the user what is already saved next to a candidate that would collide with it."""
    from ..components import CharacterService, WordService
    words, chars = WordService(), CharacterService()
    for c in result.candidates:
        if any(f.code.startswith("already_in_") for f in c.flags):
            w = words.get_by_word(c.word, language_id=job["language_id"])
            if w:
                c.existing = {"word": w.word, "translation": w.translation, "phonetic": w.phonetic, "word_type": w.word_type}
    for e in result.elements:
        if e.kind == "calligraphy":
            ch = chars.get_by_character(e.fields["character"], language_id=job["language_id"])
            if ch:
                e.existing = {"character": ch.character, "meaning": ch.meaning, "phonetic": ch.phonetic,
                              "radical": ch.radical, "strokes": ch.strokes}
                if job.get("lesson_id"):   # a character left behind by a deleted calligraphy is saved but in no lesson
                    with db_manager.session_scope() as s:
                        e.existing["in_lesson"] = s.query(Calligraphy).filter(
                            Calligraphy.character_id == ch.id, Calligraphy.lesson_id == job["lesson_id"]).first() is not None


def _classify(ctx: _Ctx, doc: Document, target_name: str) -> dict[str, list]:
    """{"page": kinds} for every page. A failed step (not a bad key/URL) means every kind, never a failed job."""
    try:
        kinds = classify_pages(doc, ctx.text_api, target_name)
    except ModelAPIError as e:
        if e.kind in _ABORT_KINDS:
            raise
        logger.warning("Page classification failed: %s", e)
        kinds = {p.index + 1: list(ALL_KINDS) for p in doc.pages}
    return {str(n): k for n, k in kinds.items()}


def _target_name(ctx: _Ctx) -> str:
    target = get_language_by_iso2t(ctx.target or "")
    return "the target language" if target.iso1 == "unknown" else target.name


def _save_document(ctx: _Ctx, doc: Document) -> None:
    out = document_path(ctx.media_root, ctx.job["id"])
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(doc.model_dump_json())


def _kinds_by_page(job: dict) -> dict[int, list] | None:
    """The job's confirmed kinds with int page keys; None (legacy job) = vocabulary only."""
    return {int(k): v for k, v in job["page_kinds"].items()} if job["page_kinds"] else None


def _run(app: Flask, svc: IngestionJobService, job_id: str) -> None:
    ctx = _prepare(app, svc, job_id)
    if ctx is None:
        return
    doc = _parse_job(svc, ctx)
    if ctx.job["lesson_id"] is None:
        return _propose_lessons(svc, ctx, doc)
    _save_document(ctx, doc)
    check_alive(svc, job_id)
    svc.update(job_id, status="pages", page_kinds=_classify(ctx, doc, _target_name(ctx)),
               warnings=ctx.warnings + [w for p in doc.pages for w in p.warnings])


def _run_extraction(app: Flask, svc: IngestionJobService, job_id: str) -> None:
    job = svc.get(job_id)
    if job is not None and job["lesson_id"] is None:
        return _run_language_extraction(app, svc, job_id)
    _run_lesson_extraction(app, svc, job_id)


def _run_lesson_extraction(app: Flask, svc: IngestionJobService, job_id: str) -> None:
    ctx = _prepare(app, svc, job_id)
    if ctx is None:
        return
    doc = Document.model_validate_json(document_path(ctx.media_root, job_id).read_text())
    svc.update(job_id, status="extracting", pages_done=0, pages_total=len(doc.pages))
    result = build_candidates(
        doc, ctx.text_api, ctx.target, ctx.source, _lookup_for(ctx.job),
        progress=_progress(svc, job_id),
        page_kinds=_kinds_by_page(ctx.job),
    )
    _attach_existing(ctx.job, result)
    warnings = ctx.warnings + result.warnings + [w for p in doc.pages for w in p.warnings]
    check_alive(svc, job_id)
    out = candidates_path(ctx.media_root, job_id)
    out.write_text(json.dumps({"candidates": [c.model_dump() for c in result.candidates],
                               "elements": [e.model_dump() for e in result.elements], "warnings": warnings}))
    svc.update(job_id, status="ready", warnings=warnings)


def _propose_lessons(svc: IngestionJobService, ctx: _Ctx, doc: Document) -> None:
    job_id = ctx.job["id"]
    _save_document(ctx, doc)
    name = _target_name(ctx)
    proposals, warnings = propose_structure(doc, ctx.text_api, name, ctx.job["filename"])
    numbers = [p.index + 1 for p in doc.pages]
    structure = {
        "confirmed": False, "first_page": min(numbers), "last_page": max(numbers),
        "lessons": [{**p.model_dump(), "ranges": [[p.start_page, p.end_page]], "index": i, "status": "pending", "error": None, "counts": None}
                    for i, p in enumerate(proposals)],
    }
    check_alive(svc, job_id)
    svc.update(job_id, status="structure", structure=structure, page_kinds=_classify(ctx, doc, name),
               warnings=ctx.warnings + warnings + [w for p in doc.pages for w in p.warnings])


def _run_language_extraction(app: Flask, svc: IngestionJobService, job_id: str) -> None:
    ctx = _prepare(app, svc, job_id)
    if ctx is None:
        return
    job = ctx.job
    structure = job["structure"]
    doc = Document.model_validate_json(document_path(ctx.media_root, job_id).read_text())
    lookup = _lookup_for(job)
    lessons = structure["lessons"]
    page_kinds = _kinds_by_page(job)
    svc.update(job_id, status="extracting", pages_done=0, pages_total=len(lessons))

    for lesson in lessons:
        ranges = lesson_ranges(lesson)
        part = Document(sha256=doc.sha256, pipeline_version=doc.pipeline_version, pages=[
            p for p in doc.pages if pages_in_ranges(ranges, p.index + 1)])
        try:
            result = build_candidates(part, ctx.text_api, ctx.target, ctx.source, lookup, page_kinds=page_kinds,
                                      progress=lambda *_: check_alive(svc, job_id))
            _attach_existing(job, result)
            candidates = [c.model_dump() for c in result.candidates]
            verified = sum(c["status"] == "verified" for c in candidates)
            out = candidates_path(ctx.media_root, job_id, lesson["index"])
            out.write_text(json.dumps({"candidates": candidates, "elements": [e.model_dump() for e in result.elements],
                                       "warnings": result.warnings}))
            lesson.update(status="done", counts={"total": len(candidates), "verified": verified,
                                                 "flagged": len(candidates) - verified,
                                                 "elements": len(result.elements)})
        except ExtractionError as e:
            lesson.update(status="failed", error=str(e))
        # a ModelAPIError (bad key, wrong URL) propagates: the whole job fails once, not once per lesson
        done = sum(l["status"] != "pending" for l in lessons)
        svc.update(job_id, structure=structure, pages_done=done)

    check_alive(svc, job_id)
    if all(l["status"] == "failed" for l in lessons):
        svc.update(job_id, status="failed", error="Extraction failed for every lesson")
    else:
        svc.update(job_id, status="ready")
