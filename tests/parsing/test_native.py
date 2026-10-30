import pymupdf

from lapp.services.parsing.native import extract_native_page


def test_native_page_is_high_trust_without_confidence(native_pdf):
    with pymupdf.open(native_pdf) as doc:
        page = extract_native_page(doc[0], 0)
    assert (page.source, page.trust, page.mean_confidence) == ("native", "native", None)
    words = [w for b in page.blocks for w in b.words]
    assert words and all(w.conf is None for w in words)


def test_heading_and_body_kinds_and_font_size(native_pdf):
    with pymupdf.open(native_pdf) as doc:
        page = extract_native_page(doc[0], 0)
    heading = next(b for b in page.blocks if "Lesson One" in b.text)
    body = next(b for b in page.blocks if "paragraph" in b.text)
    assert (heading.kind, round(heading.font_size)) == ("heading", 24)
    assert (body.kind, round(body.font_size)) == ("body", 11)


def test_short_line_group_is_list_like(native_pdf):
    with pymupdf.open(native_pdf) as doc:
        page = extract_native_page(doc[1], 1)
    vocab = next(b for b in page.blocks if "apple" in b.text)
    assert vocab.kind == "list_like"


def test_bboxes_lie_inside_the_page(native_pdf):
    with pymupdf.open(native_pdf) as doc:
        page = extract_native_page(doc[0], 0)
    for b in page.blocks:
        x0, y0, x1, y1 = b.bbox
        assert 0 <= x0 <= x1 <= page.width and 0 <= y0 <= y1 <= page.height
