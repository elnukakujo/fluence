"""Render one page of an uploaded document as a PNG so the review screen can show the real page."""
import io
import logging
from pathlib import Path

import pymupdf
from PIL import Image

logger = logging.getLogger(__name__)

PREVIEW_DPI = 110
MAX_PREVIEW_PIXELS = 4_000_000   # a huge page is scaled down, never rendered at full size


def render_page_png(path: Path, page: int) -> bytes | None:
    """PNG bytes of 1-based `page`, or None if it doesn't exist or the file is unreadable."""
    try:
        if path.suffix.lower() == ".pdf":
            with pymupdf.open(path) as pdf:
                if not 1 <= page <= pdf.page_count:
                    return None
                p = pdf[page - 1]
                dpi = min(PREVIEW_DPI, 72 * (MAX_PREVIEW_PIXELS / max(p.rect.width * p.rect.height, 1)) ** 0.5)
                return p.get_pixmap(dpi=max(int(dpi), 10), alpha=False).tobytes("png")
        if page != 1:
            return None
        with Image.open(path) as im:
            im = im.convert("RGB")
            scale = (MAX_PREVIEW_PIXELS / max(im.width * im.height, 1)) ** 0.5
            if scale < 1:
                im = im.resize((max(int(im.width * scale), 1), max(int(im.height * scale), 1)))
            buf = io.BytesIO()
            im.save(buf, "PNG")
            return buf.getvalue()
    except Exception:
        logger.warning("Could not render a preview of %s page %s", path, page, exc_info=True)
        return None
