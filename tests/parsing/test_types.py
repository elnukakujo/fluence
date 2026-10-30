import pytest
from pydantic import ValidationError

from lapp.services.parsing.types import Block, Document, Page, Word


def _block(conf):
    w = Word(text="hi", bbox=(0, 0, 1, 1), conf=conf)
    return Block(text="hi", bbox=(0, 0, 1, 1), kind="body", font_size=None, words=[w])


def _page(source, trust, conf=None, mean=None):
    return Page(index=0, width=10, height=10, source=source, trust=trust,
                blocks=[_block(conf)], mean_confidence=mean, warnings=[])


def test_native_page_requires_no_confidence():
    _page("native", "native")
    with pytest.raises(ValidationError):
        _page("native", "native", conf=0.9)


def test_remote_page_has_no_confidence():
    _page("ocr_remote", "llm_transcribed")
    with pytest.raises(ValidationError):
        _page("ocr_remote", "llm_transcribed", conf=0.9)
    with pytest.raises(ValidationError):
        _page("ocr_remote", "llm_transcribed", mean=0.9)


def test_ocr_page_trust_matches_source():
    _page("ocr_local", "ocr", conf=0.9, mean=0.9)
    with pytest.raises(ValidationError):
        _page("ocr_local", "native")
    with pytest.raises(ValidationError):
        _page("ocr_remote", "ocr", conf=0.5)


def test_local_ocr_words_need_confidence():
    with pytest.raises(ValidationError):
        _page("ocr_local", "ocr", conf=None, mean=0.9)


def test_document_roundtrips_json():
    doc = Document(sha256="ab", pipeline_version="1",
                   pages=[_page("ocr_local", "ocr", conf=0.9, mean=0.9)], warnings=["w"])
    assert Document.model_validate_json(doc.model_dump_json()) == doc
