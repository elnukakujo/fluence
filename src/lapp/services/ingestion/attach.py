"""Turn the media choices made in review into stored files, at accept time (nothing is written before)."""
import json
import logging
import shutil
import uuid
from pathlib import Path

from .jobs import job_dir
from .media import render_crop

logger = logging.getLogger(__name__)

IMAGE_EXT = (".png", ".jpg", ".jpeg", ".gif", ".bmp")
AUDIO_EXT = (".mp3", ".wav", ".ogg", ".flac", ".m4a")
MAX_UPLOAD = 20 * 1024 * 1024


def uploads_dir(media_root, job_id: str) -> Path:
    return job_dir(media_root, job_id) / "uploads"


def save_upload(media_root, job_id: str, file) -> dict:
    """Keep an uploaded image/audio under the job until accept. {id, kind} or {error}."""
    ext = Path(file.filename or "").suffix.lower()
    kind = "image" if ext in IMAGE_EXT else "audio" if ext in AUDIO_EXT else None
    if kind is None:
        return {"error": f"Use an image ({', '.join(IMAGE_EXT)}) or audio ({', '.join(AUDIO_EXT)}) file"}
    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > MAX_UPLOAD:
        return {"error": f"File too large (max {MAX_UPLOAD // (1024 * 1024)} MB)"}
    name = f"{uuid.uuid4().hex}{ext}"
    target = uploads_dir(media_root, job_id) / name
    target.parent.mkdir(parents=True, exist_ok=True)
    file.save(str(target))
    return {"id": name, "kind": kind}


def _store(media_root, folder: str, ext: str, data: bytes | None = None, source: Path | None = None) -> str:
    name = f"{uuid.uuid4().hex}{ext}"
    target = Path(media_root) / folder / name
    target.parent.mkdir(parents=True, exist_ok=True)
    if source is not None:
        shutil.copyfile(source, target)
    else:
        target.write_bytes(data or b"")
    return f"{folder}/{name}"


def _upload(media_root, job_id: str, upload_id, exts) -> Path | None:
    name = Path(str(upload_id)).name                      # no path tricks: the id is a file name
    path = uploads_dir(media_root, job_id) / name
    return path if path.is_file() and path.suffix.lower() in exts else None


def attach_image(media_root, job: dict, media: dict | None) -> str | None:
    """Path (as stored on an element) of the chosen picture: a crop of the document or an upload."""
    image = (media or {}).get("image")
    if not isinstance(image, dict):
        return None
    if image.get("upload"):
        src = _upload(media_root, job["id"], image["upload"], IMAGE_EXT)
        return _store(media_root, "images", src.suffix.lower(), source=src) if src else None
    crop = image.get("crop")
    if isinstance(crop, dict):
        png = render_crop(Path(media_root) / job["file_path"], crop)
        return _store(media_root, "images", ".png", data=png) if png else None
    return None


def attach_audio(media_root, job: dict, media: dict | None, speak) -> tuple[list[str], dict[int, int], list[str]]:
    """(audio_files, {line index: index in audio_files}, notes). Per line: an upload wins, else TTS when asked and
    available (`speak(text) -> stored path`), else the line gets no clip. A failed clip is reported, never fatal."""
    audio = (media or {}).get("audio")
    if not isinstance(audio, dict) or not isinstance(audio.get("lines"), list):
        return [], {}, []
    uploads = audio.get("uploads") if isinstance(audio.get("uploads"), dict) else {}
    files, index, notes = [], {}, []
    for i, text in enumerate(audio["lines"]):
        path = None
        if str(i) in uploads:
            src = _upload(media_root, job["id"], uploads[str(i)], AUDIO_EXT)
            path = _store(media_root, "audio", src.suffix.lower(), source=src) if src else None
        elif audio.get("tts") and speak and isinstance(text, str) and text.strip():
            try:
                path = speak(text.strip())
            except Exception as e:
                logger.warning("TTS failed for a line: %s", e)
                notes.append(f"No audio for “{text.strip()[:30]}”: {e}")
        if path:
            index[i] = len(files)
            files.append(path)
    return files, index, notes


def with_audio_indexes(question: str, answer: str, index: dict[int, int]) -> tuple[str, str]:
    """Point each conversation line at its clip (audioIndex), in both the question and the learner's answer."""
    try:
        q, a = json.loads(question), json.loads(answer)
    except ValueError:
        return question, answer
    for i, line in enumerate(q["lines"]):
        line["audioIndex"] = index.get(i)
    mine = [l for l in q["lines"] if any(l["speakerId"] == sp["id"] for sp in a["speakers"])]
    a["lines"] = [{**l} for l in mine]
    return json.dumps(q, ensure_ascii=False), json.dumps(a, ensure_ascii=False)
