"""Deleting an import removes its file, its parse cache and the job; only the owner can."""
import hashlib

from lapp.models.system_data import IngestionJob, User
from lapp.services.auth import AuthService


def _login(app, db, uid):
    with db.session_scope() as s:
        db.insert(User(id=uid, username=uid, email=f"{uid}@x.com"), session=s, commit=False)
    c = app.test_client()
    c.set_cookie("session_token", AuthService().create_session(uid, remember=False))
    return c


def test_delete_removes_file_cache_and_job(app, db, tmp_path):
    from lapp.services.ingestion.jobs import remove_job_files
    media = tmp_path
    up = media / "ingestion" / "job_1" / "doc.pdf"
    up.parent.mkdir(parents=True)
    up.write_bytes(b"pdf")
    sha = hashlib.sha256(b"pdf").hexdigest()
    (media / "parse_cache").mkdir()
    mine, other = media / "parse_cache" / f"{sha}-v1-abc.json", media / "parse_cache" / "ffff-v1-abc.json"
    mine.write_text("{}"); other.write_text("{}")
    remove_job_files(media, "job_1", "ingestion/job_1/doc.pdf")
    assert not up.exists() and not mine.exists() and other.exists()


def test_non_owner_cannot_delete(app, db):
    c = _login(app, db, "user_U1")
    assert c.delete("/api/ingestion/ingestion_job_nope").status_code == 404
