from lapp.services.ingestion import chunk as chunk_module
from lapp.services.ingestion.chunk import chunk_document
from lapp.services.parsing.types import Block, Document, Page, Word


def _word(text, x0, y0, x1, y1, conf=None):
    return Word(text=text, bbox=(x0, y0, x1, y1), conf=conf)


def _native_block(text, y, kind="body", size=11.0):
    words = [_word(w, 10 + i * 40, y, 45 + i * 40, y + 12) for i, w in enumerate(text.split())]
    return Block(text=text, bbox=(10, y, 10 + 40 * len(words), y + 12), kind=kind, font_size=size, words=words)


def _doc(*pages):
    return Document(sha256="x", pipeline_version="1", pages=list(pages))


def _native_page(index, blocks):
    return Page(index=index, width=600, height=800, source="native", trust="native", blocks=blocks)


def _ocr_block(text, x0, y0, x1, y1, conf=0.95):
    return Block(text=text, bbox=(x0, y0, x1, y1), words=[_word(text, x0, y0, x1, y1, conf)])


def _ocr_page(index, blocks, source="ocr_local"):
    trust = "ocr" if source == "ocr_local" else "llm_transcribed"
    return Page(index=index, width=600, height=800, source=source, trust=trust, blocks=blocks,
                mean_confidence=0.95 if trust == "ocr" else None)


def test_one_chunk_per_page_with_page_index_and_trust():
    doc = _doc(_native_page(0, [_native_block("apple manzana", 10)]),
               _ocr_page(1, [_ocr_block("casa", 10, 10, 60, 30)]))
    chunks = chunk_document(doc)
    assert [(c.page, c.trust) for c in chunks] == [(0, "native"), (1, "ocr")]
    assert len({c.id for c in chunks}) == 2


def test_native_heading_starts_a_new_chunk():
    page = _native_page(0, [_native_block("Lesson One", 10, "heading", 24), _native_block("apple manzana", 40),
                            _native_block("Lesson Two", 80, "heading", 24), _native_block("house casa", 110)])
    chunks = chunk_document(_doc(page))
    assert [c.text for c in chunks] == ["Lesson One\napple manzana", "Lesson Two\nhouse casa"]


def test_long_page_splits_on_block_boundaries(monkeypatch):
    monkeypatch.setattr(chunk_module, "MAX_CHUNK_CHARS", 30)
    blocks = [_native_block("aaaaaaaaaaaaaaaaaaaa", 10), _native_block("bbbbbbbbbbbbbbbbbbbb", 40),
              _native_block("cc", 70)]
    texts = [c.text for c in chunk_document(_doc(_native_page(0, blocks)))]
    assert texts == ["aaaaaaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbbbbbb\ncc"]


def test_ocr_blocks_on_one_visual_line_are_joined_with_a_space():
    blocks = [_ocr_block("monde", 300, 12, 420, 52), _ocr_block("bonjour", 0, 10, 140, 50),
              _ocr_block("second", 0, 100, 200, 140)]
    chunk = chunk_document(_doc(_ocr_page(0, blocks)))[0]
    assert chunk.text == "bonjour monde\nsecond"


def test_pages_without_text_produce_no_chunk():
    doc = _doc(_native_page(0, []), _ocr_page(1, [_ocr_block("   ", 0, 0, 10, 10)]), _ocr_page(2, []))
    assert chunk_document(doc) == []


def test_chunk_keeps_parser_words_and_confidence():
    chunk = chunk_document(_doc(_ocr_page(0, [_ocr_block("casa", 10, 10, 60, 30, conf=0.4)])))[0]
    assert [(w.text, w.conf) for w in chunk.words] == [("casa", 0.4)]


def test_remote_page_chunk_is_llm_transcribed():
    blocks = [Block(text="bonjour", bbox=(0, 0, 600, 800))]
    chunk = chunk_document(_doc(_ocr_page(0, blocks, source="ocr_remote")))[0]
    assert chunk.trust == "llm_transcribed" and chunk.text == "bonjour" and chunk.words == []
