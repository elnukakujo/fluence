"""Support pictures for imported items: find the picture next to an item on its page, and crop it at accept time."""
import io
import logging
import re
from pathlib import Path

import pymupdf
from PIL import Image

from .types import Chunk
from .verify import normalise

logger = logging.getLogger(__name__)

BAND = 40          # how far above/below an item (page units) a picture may sit and still belong to it
PAD = 8
CROP_DPI = 150


def _union(boxes):
    return [min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)]


def quote_region(chunk: Chunk, quote: str) -> list[float] | None:
    """Bounding box of the words that spell `quote` in the chunk (all the chunk's words if it cannot be located)."""
    if not chunk.words:
        return None
    texts = [re.sub(r"\s+", "", normalise(w.text)) for w in chunk.words]
    joined, starts = "", []
    for t in texts:
        starts.append(len(joined))
        joined += t
    q = re.sub(r"\s+", "", normalise(quote))
    at = joined.find(q) if q else -1
    if at < 0:
        return _union([w.bbox for w in chunk.words])
    hit = [w.bbox for w, st, t in zip(chunk.words, starts, texts) if st < at + len(q) and st + len(t) > at]
    return _union(hit or [w.bbox for w in chunk.words])


def image_crop(page, chunk: Chunk, quote: str) -> dict | None:
    """{page, bbox, page_size, has_picture} when a picture sits beside the item, else None (nothing is offered).
    `page` is the parsed page (width/height/images)."""
    region = quote_region(chunk, quote)
    if region is None or not page.images:
        return None
    near = [b for b in page.images
            if b[3] >= region[1] - BAND and b[1] <= region[3] + BAND
            and (b[2] - b[0]) * (b[3] - b[1]) < 0.8 * page.width * page.height]    # a full-page scan background is not a picture
    if not near:
        return None
    x0, y0, x1, y1 = _union([region, *near])
    box = [max(x0 - PAD, 0), max(y0 - PAD, 0), min(x1 + PAD, page.width), min(y1 + PAD, page.height)]
    return {"page": chunk.page, "bbox": box, "page_size": [page.width, page.height], "has_picture": True}


def render_crop(path: Path, crop: dict) -> bytes | None:
    """PNG bytes of the cropped region, or None if the document cannot be read."""
    try:
        x0, y0, x1, y1 = crop["bbox"]
        if path.suffix.lower() == ".pdf":
            with pymupdf.open(path) as pdf:
                return pdf[crop["page"]].get_pixmap(dpi=CROP_DPI, clip=pymupdf.Rect(x0, y0, x1, y1), alpha=False).tobytes("png")
        with Image.open(path) as im:
            sx, sy = im.width / crop["page_size"][0], im.height / crop["page_size"][1]
            buf = io.BytesIO()
            im.convert("RGB").crop((int(x0 * sx), int(y0 * sy), int(x1 * sx), int(y1 * sy))).save(buf, "PNG")
            return buf.getvalue()
    except Exception:
        logger.warning("Could not crop %s", path, exc_info=True)
        return None
