"""Per-page decision: does the PDF page carry a trustworthy embedded text layer?"""
import logging
import unicodedata

import pymupdf

logger = logging.getLogger(__name__)

# TODO(calibrate): needs real sample files - conservative placeholders, not measured values.
MIN_CHARS_PER_1000PT2 = 0.1       # ~50 characters on an A4 page
MAX_GARBAGE_RATIO = 0.05
MAX_IMAGE_COVERAGE = 0.8          # fraction of the page one image may cover ...
MIN_TEXT_OVER_IMAGE = 0.5         # ... unless the text layer is at least this dense


def _is_garbage(ch: str) -> bool:
    # U+FFFD, private-use and control chars (not whitespace) - script-agnostic
    return ch == "�" or unicodedata.category(ch) in ("Co", "Cc", "Cs", "Cn")


def is_native_page(page: pymupdf.Page) -> tuple[bool, dict]:
    chars = [c for c in page.get_text("text") if not c.isspace()]
    area = page.rect.width * page.rect.height
    density = len(chars) / area * 1000 if area else 0.0
    garbage = sum(_is_garbage(c) for c in chars) / len(chars) if chars else 1.0
    coverage = max(
        (pymupdf.Rect(i["bbox"]) & page.rect).get_area() / page.rect.get_area()
        for i in page.get_image_info()
    ) if page.get_image_info() else 0.0
    measured = {"chars_per_1000pt2": density, "garbage_ratio": garbage, "image_coverage": coverage}
    native = (
        density >= MIN_CHARS_PER_1000PT2
        and garbage <= MAX_GARBAGE_RATIO
        and not (coverage > MAX_IMAGE_COVERAGE and density < MIN_TEXT_OVER_IMAGE)
    )
    logger.info("page %s native=%s %s", page.number, native, measured)
    return native, measured
