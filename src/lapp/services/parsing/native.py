"""Read a native PDF page: text, layout (font size, headings) and word boxes, no OCR."""
import statistics

import pymupdf

from .types import Block, Page, Word

# TODO(calibrate): needs real sample files
HEADING_SIZE_RATIO = 1.4      # block font size vs the page's median span size
LIST_MIN_LINES = 3
LIST_MAX_LINE_CHARS = 40


def extract_native_page(page: pymupdf.Page, index: int) -> Page:
    raw = [b for b in page.get_text("dict")["blocks"] if b["type"] == 0]
    sizes = [s["size"] for b in raw for ln in b["lines"] for s in ln["spans"] for _ in s["text"].strip()]
    median = statistics.median(sizes) if sizes else 0.0

    all_words = [
        Word(text=text, bbox=(x0, y0, x1, y1))
        for x0, y0, x1, y1, text, *_ in page.get_text("words")
    ]

    def words_in(box) -> list[Word]:
        # by position: get_text("words") numbers blocks differently from "dict" once the page has images
        bx0, by0, bx1, by1 = box
        return [w for w in all_words
                if bx0 <= (w.bbox[0] + w.bbox[2]) / 2 <= bx1 and by0 <= (w.bbox[1] + w.bbox[3]) / 2 <= by1]

    blocks = []
    for b in raw:
        lines = ["".join(s["text"] for s in ln["spans"]).strip() for ln in b["lines"]]
        lines = [ln for ln in lines if ln]
        if not lines:
            continue
        size = max(s["size"] for ln in b["lines"] for s in ln["spans"] if s["text"].strip())
        if median and size >= median * HEADING_SIZE_RATIO:
            kind = "heading"
        # ponytail: crude heuristic (short stacked lines); real vocab detection belongs to extraction
        elif len(lines) >= LIST_MIN_LINES and max(map(len, lines)) <= LIST_MAX_LINE_CHARS:
            kind = "list_like"
        else:
            kind = "body"
        blocks.append(Block(text="\n".join(lines), bbox=tuple(b["bbox"]), kind=kind,
                            font_size=size, words=words_in(b["bbox"])))
    return Page(index=index, width=page.rect.width, height=page.rect.height,
                source="native", trust="native", blocks=blocks, mean_confidence=None)
