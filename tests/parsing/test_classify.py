import pymupdf

from lapp.services.parsing.classify import is_native_page


def _decisions(path):
    with pymupdf.open(path) as doc:
        return [is_native_page(p)[0] for p in doc]


def test_native_pdf_pages_are_native(native_pdf):
    assert _decisions(native_pdf) == [True, True]


def test_scanned_pdf_pages_are_not_native(scanned_pdf):
    assert _decisions(scanned_pdf) == [False, False]


def test_garbled_text_layer_is_not_native(garbled_pdf):
    assert _decisions(garbled_pdf) == [False]


def test_mixed_pdf_is_classified_per_page(mixed_pdf):
    assert _decisions(mixed_pdf) == [True, False]


def test_cjk_page_without_spaces_is_native(cjk_pdf):
    assert _decisions(cjk_pdf) == [True]


def test_measured_values_are_returned(native_pdf):
    with pymupdf.open(native_pdf) as doc:
        _, m = is_native_page(doc[0])
    assert {"chars_per_1000pt2", "garbage_ratio", "image_coverage"} <= m.keys()


def test_invisible_ocr_text_layer_is_not_native(searchable_scan_pdf):
    assert _decisions(searchable_scan_pdf) == [False]
