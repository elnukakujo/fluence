import pytest


@pytest.fixture()
def media_root(app, tmp_path):
    old = app.config["MEDIA_ROOT"]
    app.config["MEDIA_ROOT"] = str(tmp_path)
    yield tmp_path
    app.config["MEDIA_ROOT"] = old


@pytest.fixture()
def scheduled(app, monkeypatch):
    """Capture scheduled job ids instead of queueing real work."""
    ids = []
    monkeypatch.setattr(app.scheduler, "schedule_ingestion", lambda a, job_id: ids.append(job_id))
    return ids
