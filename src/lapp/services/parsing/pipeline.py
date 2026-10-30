"""parse(): route each page native vs OCR, escalate low-confidence pages, cache by content hash."""
import hashlib
import logging
import os
import tempfile
from pathlib import Path

import cv2
import numpy as np
import pymupdf

from ...utils.model_api import ModelAPIError
from .classify import is_native_page
from .native import extract_native_page
from .ocr import OcrEngine, RapidOcrEngine, script_for
from .preprocess import preprocess
from .types import Block, Document, Page, ParseError

logger = logging.getLogger(__name__)

PIPELINE_VERSION = "1"
MAX_FILE_BYTES = 50 * 1024 * 1024
MAX_PAGES = 100
RENDER_DPI = 200
# TODO(calibrate): needs real sample files - placeholders, not measured values
ESCALATE_MEAN_CONF = 0.80
LOW_WORD_CONF = 0.60
ESCALATE_LOW_WORD_SHARE = 0.30

_IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".bmp"}


def parse(
    path: str | Path,
    *,
    target_iso639_2t: str | None,
    source_iso639_2t: str | None = None,
    remote: OcrEngine | None = None,
    local: OcrEngine | None = None,
    handwritten: bool = False,
    cache_dir: Path | None = None,
) -> Document:
    """Parse a PDF or image into a Document. `cache_dir=None` disables caching (the library is Flask-free)."""
    path = Path(path)
    suffix = path.suffix.lower()
    if suffix != ".pdf" and suffix not in _IMAGE_SUFFIXES:
        raise ParseError("unsupported", f"Unsupported file type {suffix or '(none)'}")
    if path.stat().st_size > MAX_FILE_BYTES:
        raise ParseError("too_large", "File is too large")
    data = path.read_bytes()
    sha = hashlib.sha256(data).hexdigest()

    key = hashlib.sha256(
        f"{target_iso639_2t}|{source_iso639_2t}|{handwritten}|{remote is not None}".encode()
    ).hexdigest()[:10]
    cache_file = cache_dir / f"{sha}-v{PIPELINE_VERSION}-{key}.json" if cache_dir else None
    if cache_file and cache_file.is_file():
        try:
            return Document.model_validate_json(cache_file.read_text())
        except ValueError:
            logger.warning("Ignoring unreadable parse cache %s", cache_file)

    ctx = _Ctx(target_iso639_2t, local, remote, handwritten)
    doc = Document(sha256=sha, pipeline_version=PIPELINE_VERSION, pages=[], warnings=[])
    if handwritten and remote is None:
        doc.warnings.append("handwritten requested but no remote OCR is configured; used local OCR")
    if suffix == ".pdf":
        _parse_pdf(data, ctx, doc)
    else:
        img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            raise ParseError("corrupt", "Could not read the image")
        doc.pages.append(_ocr_page(img, 0, (float(img.shape[1]), float(img.shape[0])), ctx))

    if cache_file:
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=cache_file.parent, suffix=".tmp")
        with os.fdopen(fd, "w") as f:
            f.write(doc.model_dump_json())
        os.replace(tmp, cache_file)
    return doc


class _Ctx:
    def __init__(self, target, local, remote, handwritten):
        self.target, self.remote, self.handwritten = target, remote, handwritten
        self._local = local

    @property
    def local(self) -> OcrEngine:
        if self._local is None:
            self._local = RapidOcrEngine()
        return self._local


def _parse_pdf(data: bytes, ctx: _Ctx, doc: Document) -> None:
    try:
        pdf = pymupdf.open(stream=data, filetype="pdf")
    except Exception as e:
        raise ParseError("corrupt", f"Could not read the PDF: {e}") from e
    with pdf:
        if pdf.needs_pass:
            raise ParseError("encrypted", "The PDF is password-protected")
        if pdf.page_count == 0:
            raise ParseError("corrupt", "The PDF has no pages")
        if pdf.page_count > MAX_PAGES:
            raise ParseError("too_many_pages", f"The PDF has more than {MAX_PAGES} pages")
        for i, page in enumerate(pdf):
            native, _ = is_native_page(page)
            if native:
                doc.pages.append(extract_native_page(page, i))
            else:
                doc.pages.append(_ocr_page(_render(page), i, (page.rect.width, page.rect.height), ctx))


def _render(page: pymupdf.Page) -> np.ndarray:
    pix = page.get_pixmap(dpi=RENDER_DPI, colorspace=pymupdf.csRGB, alpha=False)
    rgb = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, 3)
    return rgb[:, :, ::-1].copy()  # BGR


def _stats(blocks: list[Block]) -> tuple[float | None, float]:
    confs = [w.conf for b in blocks for w in b.words if w.conf is not None]
    if not confs:
        return None, 1.0
    return sum(confs) / len(confs), sum(c < LOW_WORD_CONF for c in confs) / len(confs)


def _ocr_page(img: np.ndarray, index: int, size: tuple[float, float], ctx: _Ctx) -> Page:
    script_for(ctx.target)  # raises for deferred languages before any work is done
    w, h = size
    clean = preprocess(img)
    if (clean == 255).all():
        return Page(index=index, width=w, height=h, source="ocr_local", trust="ocr",
                    warnings=["blank page: no text found"])

    if ctx.handwritten and ctx.remote:
        remote_page = _try_remote(img, index, size, ctx)
        if isinstance(remote_page, Page):
            return remote_page
        warnings = [remote_page]
    else:
        warnings = []

    try:
        blocks = ctx.local.ocr(clean, ctx.target, size)
    except ParseError:
        raise
    except Exception as e:
        logger.exception("Local OCR failed on page %s", index)
        return Page(index=index, width=w, height=h, source="ocr_local", trust="ocr",
                    warnings=warnings + [f"OCR failed: {e}"])

    mean, low_share = _stats(blocks)
    page = Page(index=index, width=w, height=h, source="ocr_local", trust="ocr", blocks=blocks,
                mean_confidence=mean, warnings=warnings)
    if mean is not None and mean >= ESCALATE_MEAN_CONF and low_share <= ESCALATE_LOW_WORD_SHARE:
        return page

    reason = "no text recognized" if mean is None else f"low OCR confidence (mean {mean:.2f})"
    if not ctx.remote:
        page.warnings.append(f"{reason}; no remote OCR configured")
        return page
    if ctx.handwritten:  # remote already tried above
        page.warnings.append(reason)
        return page
    remote_page = _try_remote(img, index, size, ctx)
    if isinstance(remote_page, Page):
        return remote_page
    page.warnings += [reason, remote_page]
    return page


def _try_remote(img: np.ndarray, index: int, size: tuple[float, float], ctx: _Ctx) -> Page | str:
    """The remote page, or a warning string explaining why the local result stands."""
    try:
        blocks = ctx.remote.ocr(img, ctx.target, size)
    except (ModelAPIError, ParseError) as e:
        return f"remote OCR failed: {e}"
    if not blocks:
        return "remote OCR returned no text"
    return Page(index=index, width=size[0], height=size[1], source="ocr_remote",
                trust="llm_transcribed", blocks=blocks)
