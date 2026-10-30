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
from ...models.system_data import IngestionJob
from ...utils.llm_providers import resolve_api
from ...utils.model_api import ModelAPIError
from ..parsing import ParseError, RemoteOcrEngine, parse
from .extract import ExtractionError
from .pipeline import build_candidates

logger = logging.getLogger(__name__)

_UNSAFE = re.compile(r"[^A-Za-z0-9._-]+")


def safe_filename(name: str) -> str:
    """Keep only a plain, short file name (no directories, no odd characters)."""
    base = _UNSAFE.sub("_", Path(name or "upload").name).strip("._") or "upload"
    suffix = Path(base).suffix[:10]
    return base[:80 - len(suffix)] + suffix if len(base) > 80 else base


def job_dir(media_root: str | Path, job_id: str) -> Path:
    return Path(media_root) / "ingestion" / job_id


def candidates_path(media_root: str | Path, job_id: str) -> Path:
    return job_dir(media_root, job_id) / "candidates.json"


class IngestionJobService:
    @transactional
    def create(self, user_id: str, language_id: str, lesson_id: Optional[str], filename: str,
               handwritten: bool = False, session: Optional[Session] = None) -> dict:
        job_id = db_manager.generate_new_id(IngestionJob, session=session)
        job = IngestionJob(
            id=job_id, user_id=user_id, language_id=language_id, lesson_id=lesson_id,
            filename=filename, file_path=f"ingestion/{job_id}/{safe_filename(filename)}",
            handwritten=handwritten, status="queued", warnings=[],
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
    """Background entry point: parse -> chunk -> extract -> verify -> candidates.json. Never raises."""
    with app.app_context():
        svc = IngestionJobService()
        try:
            _run(app, svc, job_id)
        except ParseError as e:
            svc.update(job_id, status="failed", error=f"{e.code}: {e}")
        except (ExtractionError, ModelAPIError) as e:
            svc.update(job_id, status="failed", error=f"Extraction failed: {e}")
        except Exception:
            logger.exception("Ingestion job %s crashed", job_id)
            svc.update(job_id, status="failed", error="Unexpected error while processing the document")


def _run(app: Flask, svc: IngestionJobService, job_id: str) -> None:
    from ..containers import LanguageService
    from ..components import WordService
    from ..system_data import UserPreferencesService

    job = svc.get(job_id)
    if job is None:
        return
    media_root = Path(app.config["MEDIA_ROOT"])

    prefs = UserPreferencesService().get_by_user_id(job["user_id"])
    text_api = resolve_api(prefs, "text_gen") if prefs else None
    if not text_api:
        svc.update(job_id, status="failed", error="No text-generation endpoint is configured in your settings")
        return
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
        return
    target, source = language.get("target_iso639_2t"), language.get("source_iso639_2t")

    svc.update(job_id, status="parsing")
    doc = parse(media_root / job["file_path"], target_iso639_2t=target, source_iso639_2t=source,
                remote=remote, handwritten=job["handwritten"], cache_dir=media_root / "parse_cache")

    svc.update(job_id, status="extracting", pages_done=0, pages_total=len(doc.pages))
    word_service = WordService()
    result = build_candidates(
        doc, text_api, target, source,
        exists=lambda w: word_service.get_by_word(w, language_id=job["language_id"]) is not None,
        progress=lambda done, total: svc.update(job_id, pages_done=done, pages_total=total),
    )
    warnings += result.warnings + [w for p in doc.pages for w in p.warnings]

    out = candidates_path(media_root, job_id)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"candidates": [c.model_dump() for c in result.candidates], "warnings": warnings}))
    svc.update(job_id, status="ready", warnings=warnings)
