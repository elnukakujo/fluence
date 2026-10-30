import threading
import time

from flask import Flask

from lapp.core.scheduler import AppScheduler
from lapp.services.ingestion import jobs as jobs_module


def test_ingestion_jobs_run_one_at_a_time_on_the_ingest_executor(monkeypatch):
    events, lock = [], threading.Lock()

    def fake_run(app, job_id):
        with lock:
            events.append(("start", job_id))
        time.sleep(0.3)
        with lock:
            events.append(("end", job_id))

    monkeypatch.setattr(jobs_module, "run_ingestion_job", fake_run)
    sched = AppScheduler()
    sched.scheduler.start()
    try:
        app = Flask("t")
        sched.schedule_ingestion(app, "a")
        sched.schedule_ingestion(app, "b")
        deadline = time.time() + 5
        while len(events) < 4 and time.time() < deadline:
            time.sleep(0.05)
    finally:
        sched.scheduler.shutdown(wait=False)
    assert [e[0] for e in events] == ["start", "end", "start", "end"]   # never overlapping
    assert {e[1] for e in events} == {"a", "b"}
