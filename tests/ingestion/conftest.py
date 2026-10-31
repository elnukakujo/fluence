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


@pytest.fixture(autouse=True)
def vocabulary_only_classifier(monkeypatch):
    """Never hit a model to classify pages; tests that care override jobs.classify_pages."""
    from lapp.services.ingestion import jobs
    monkeypatch.setattr(jobs, "classify_pages", lambda doc, api, name: {p.index + 1: ["vocabulary"] for p in doc.pages})
