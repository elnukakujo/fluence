"""Background generation job: plan, generate, judge, then save the whole batch in one transaction."""
import logging
import threading
import uuid

from flask import Flask

from ...core.database import db_manager
from ...schemas import ExerciseDict
from ...utils import get_language_by_iso2t
from ...utils.llm_providers import resolve_api
from ..features.exercise import ExerciseService
from ..system_data import UserPreferencesService
from .generate import KNOWN_MAX, add_mentioned_links, generate_batch, judge_batch
from .planner import plan_slots
from .pool import lesson_pool

logger = logging.getLogger(__name__)
# ponytail: in-process state (lost on restart, not shared between workers); a multi-worker deployment needs a shared store
_jobs: dict[str, dict] = {}
_lock = threading.Lock()


def start_job(app: Flask, user_id: str, lesson_id: str, count: int, api: dict, target: str, source: str | None = None) -> str:
    job_id = "gen_" + uuid.uuid4().hex[:12]
    with _lock:
        _jobs[job_id] = {"user_id": user_id, "state": "running", "done": 0, "total": count}
    threading.Thread(target=_run, args=(app, job_id, user_id, lesson_id, count, api, target, source), daemon=True).start()
    return job_id


def get_job(job_id: str, user_id: str) -> dict | None:
    job = _jobs.get(job_id)
    return {k: v for k, v in job.items() if k != "user_id"} if job and job["user_id"] == user_id else None


def target_name(iso2t: str | None) -> str:
    language = get_language_by_iso2t(iso2t or "")
    return "the target language" if language.iso1 == "unknown" else language.name


def _run(app: Flask, job_id: str, user_id: str, lesson_id: str, count: int, api: dict, target: str, source: str | None) -> None:
    job = _jobs[job_id]
    with app.app_context():
        try:
            with db_manager.session_scope() as s:
                pool = lesson_pool(lesson_id, user_id, s)
                prefs = UserPreferencesService().get_by_user_id(user_id, session=s)
                tts = prefs.ai_tts_enabled is not False and resolve_api(prefs, "tts") is not None
                slots = plan_slots(pool, count, prefs.exercise_type_prefs, tts)
            job["total"] = len(slots)
            known = [p.label for p in pool][:KNOWN_MAX]
            items = generate_batch(slots, api, target, lambda: job.update(done=job["done"] + 1), source=source, known=known)
            add_mentioned_links(items, pool)
            reasons = judge_batch(items, api, target, known=known)
            batch_id = "batch_" + uuid.uuid4().hex[:12]
            created: list[tuple[str, str | None]] = []
            with db_manager.session_scope() as s:
                for item, reason in zip(items, reasons):
                    fields = {k: item[k] for k in ("exercise_type", "question", "answer", "text_support", "content",
                                                   "related_vocabulary", "related_grammar", "related_calligraphy")}
                    made = ExerciseService().create(ExerciseDict(lesson_id=lesson_id, generation_batch_id=batch_id, review_reason=reason, **fields),
                                                    session=s, as_dict=True)
                    created.append((made["id"], reason))
            job.update(state="done", done=job["total"], result={
                "batch_id": batch_id, "saved": sum(1 for _, r in created if not r), "flagged": [i for i, r in created if r]})
        except Exception as e:   # reported to the poller; the save is one transaction, so nothing half-saved
            logger.exception("Exercise generation %s failed", job_id)
            job.update(state="failed", error=str(e) or "Generation failed")
