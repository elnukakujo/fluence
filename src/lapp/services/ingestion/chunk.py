"""Cut a parsed Document into pieces small enough for one LLM call, keeping page and word provenance."""
from ..parsing.ocr import group_lines
from ..parsing.types import Block, Document, Page, Word
from .types import Chunk

MAX_CHUNK_CHARS = 3000  # TODO(calibrate): needs real sample files


def chunk_document(doc: Document) -> list[Chunk]:
    chunks: list[Chunk] = []
    for page in doc.pages:
        for i, (text, words) in enumerate(_page_pieces(page)):
            chunks.append(Chunk(id=f"p{page.index}c{i}", page=page.index, text=text, trust=page.trust, words=words))
    return chunks


def _page_pieces(page: Page) -> list[tuple[str, list[Word]]]:
    """(text, words) pieces for one page: blocks become lines, pieces split on headings and size."""
    lines = _lines(page)
    pieces: list[tuple[str, list[Word]]] = []
    cur_text: list[str] = []
    cur_words: list[Word] = []
    cur_len = 0
    has_body = False

    def flush():
        nonlocal cur_text, cur_words, cur_len, has_body
        if "".join(cur_text).strip():
            pieces.append(("\n".join(cur_text), cur_words))
        cur_text, cur_words, cur_len, has_body = [], [], 0, False

    for text, words, is_heading in lines:
        if not text.strip():
            continue
        if cur_text and ((is_heading and has_body) or cur_len + len(text) + 1 > MAX_CHUNK_CHARS):
            flush()
        cur_text.append(text)
        cur_words.extend(words)
        cur_len += len(text) + 1
        has_body = has_body or not is_heading
    flush()
    return pieces


def _lines(page: Page) -> list[tuple[str, list[Word], bool]]:
    if page.source == "native":
        return [(b.text, b.words, b.kind == "heading") for b in page.blocks]
    if page.source == "ocr_remote":  # the model gave no positions: every block already is a line
        return [(b.text, b.words, False) for b in page.blocks]
    out = []
    for line in group_lines(page.blocks):   # local OCR: rebuild visual lines from bbox
        out.append((" ".join(b.text for b in line), [w for b in line for w in b.words], False))
    return out
