"""Ingestion jobs: the DB row, the on-disk files, and the background runner."""
import json
import logging
import re
import shutil
from pathlib import Path
from typing import Optional

from flask import Flask
from sqlalchemy.orm import Session

from ...core.database import db_manager, transactional
from ...models.features import Vocabulary
from ...models.system_data import IngestionJob
from ...utils.llm_providers import resolve_api
from ...utils.model_api import ModelAPIError
from ...utils.detect_language import get_language_by_iso2t
from ..parsing import ParseError, RemoteOcrEngine, parse
from ..parsing.types import Document
from .extract import ExtractionError
from .pipeline import build_candidates
from .structure import propose_structure

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


class IngestionJobService:
    @transactional
    def create(self, user_id: str, language_id: str, lesson_id: Optional[str], filename: str,
               handwritten: bool = False, page_from: Optional[int] = None, page_to: Optional[int] = None,
               session: Optional[Session] = None) -> dict:
        job_id = db_manager.generate_new_id(IngestionJob, session=session)
        job = IngestionJob(
            id=job_id, user_id=user_id, language_id=language_id, lesson_id=lesson_id,
            filename=filename, file_path=f"ingestion/{job_id}/{safe_filename(filename)}",
            handwritten=handwritten, page_from=page_from, page_to=page_to, status="queued", warnings=[],
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
        """At server start, jobs still parsing/extracting died with the previous process."""
        jobs = session.query(IngestionJob).filter(IngestionJob.status.in_(["parsing", "extracting"])).all()
        for job in jobs:
            job.status, job.error = "failed", "Interrupted by a server restart - please upload again"
        session.flush()
        return len(jobs)


def remove_job_files(media_root: str | Path, job_id: str) -> None:
    shutil.rmtree(job_dir(media_root, job_id), ignore_errors=True)


def run_ingestion_job(app: Flask, job_id: str) -> None:
    """Background entry point. Lesson-level: parse -> chunk -> extract -> verify -> candidates.json.
    Language-level: parse -> propose lessons -> wait for the user. Never raises."""
    _guarded(app, job_id, _run)


def run_language_extraction(app: Flask, job_id: str) -> None:
    """Second background step of a language-level import, scheduled once the user confirmed the lessons."""
    _guarded(app, job_id, _run_language_extraction)


def _guarded(app: Flask, job_id: str, step) -> None:
    with app.app_context():
        svc = IngestionJobService()
        try:
            step(app, svc, job_id)
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
            remote = RemoteOcrEngine(ocr_api)
        except ParseError as e:
            warnings.append(f"Vision OCR endpoint ignored: {e}")
    language = LanguageService().get_by_id(job["language_id"], as_dict=True, include_relations=False)
    if not language:
        svc.update(job_id, status="failed", error="The language no longer exists")
        return None
    return _Ctx(job, Path(app.config["MEDIA_ROOT"]), text_api, remote,
                language.get("target_iso639_2t"), language.get("source_iso639_2t"), warnings)


def _parse_job(svc: IngestionJobService, ctx: _Ctx) -> Document:
    svc.update(ctx.job["id"], status="parsing")
    job = ctx.job
    return parse(ctx.media_root / job["file_path"], target_iso639_2t=ctx.target, source_iso639_2t=ctx.source,
                 remote=ctx.remote, handwritten=job["handwritten"], cache_dir=ctx.media_root / "parse_cache",
                 pages=(job["page_from"], job["page_to"]) if job["page_from"] else None)


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


def _run(app: Flask, svc: IngestionJobService, job_id: str) -> None:
    ctx = _prepare(app, svc, job_id)
    if ctx is None:
        return
    doc = _parse_job(svc, ctx)
    if ctx.job["lesson_id"] is None:
        return _propose_lessons(svc, ctx, doc)

    svc.update(job_id, status="extracting", pages_done=0, pages_total=len(doc.pages))
    result = build_candidates(
        doc, ctx.text_api, ctx.target, ctx.source, _lookup_for(ctx.job),
        progress=lambda done, total: svc.update(job_id, pages_done=done, pages_total=total),
    )
    warnings = ctx.warnings + result.warnings + [w for p in doc.pages for w in p.warnings]
    out = candidates_path(ctx.media_root, job_id)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"candidates": [c.model_dump() for c in result.candidates], "warnings": warnings}))
    svc.update(job_id, status="ready", warnings=warnings)


def _propose_lessons(svc: IngestionJobService, ctx: _Ctx, doc: Document) -> None:
    job_id = ctx.job["id"]
    out = document_path(ctx.media_root, job_id)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(doc.model_dump_json())

    target = get_language_by_iso2t(ctx.target or "")
    proposals, warnings = propose_structure(
        doc, ctx.text_api, "the target language" if target.iso1 == "unknown" else target.name, ctx.job["filename"])
    numbers = [p.index + 1 for p in doc.pages]
    structure = {
        "confirmed": False, "first_page": min(numbers), "last_page": max(numbers),
        "lessons": [{**p.model_dump(), "index": i, "status": "pending", "error": None, "counts": None}
                    for i, p in enumerate(proposals)],
    }
    svc.update(job_id, status="structure", structure=structure,
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
    svc.update(job_id, status="extracting", pages_done=0, pages_total=len(lessons))

    for lesson in lessons:
        part = Document(sha256=doc.sha256, pipeline_version=doc.pipeline_version, pages=[
            p for p in doc.pages if lesson["start_page"] <= p.index + 1 <= lesson["end_page"]])
        try:
            result = build_candidates(part, ctx.text_api, ctx.target, ctx.source, lookup)
            candidates = [c.model_dump() for c in result.candidates]
            verified = sum(c["status"] == "verified" for c in candidates)
            out = candidates_path(ctx.media_root, job_id, lesson["index"])
            out.write_text(json.dumps({"candidates": candidates, "warnings": result.warnings}))
            lesson.update(status="done", counts={"total": len(candidates), "verified": verified,
                                                 "flagged": len(candidates) - verified})
        except ExtractionError as e:
            lesson.update(status="failed", error=str(e))
        # a ModelAPIError (bad key, wrong URL) propagates: the whole job fails once, not once per lesson
        done = sum(l["status"] != "pending" for l in lessons)
        svc.update(job_id, structure=structure, pages_done=done)

    if all(l["status"] == "failed" for l in lessons):
        svc.update(job_id, status="failed", error="Extraction failed for every lesson")
    else:
        svc.update(job_id, status="ready")
