import pymupdf
import pytest

from lapp.services.parsing import pipeline
from lapp.services.parsing.pipeline import parse
from lapp.services.parsing.types import Block, ParseError, Word
from lapp.utils.model_api import ModelAPIError


class Stub:
    """OcrEngine double: records calls; `conf=None` makes it behave like the remote engine."""

    def __init__(self, conf=0.95, text="bonjour", fail=None, empty=False):
        self.conf, self.text, self.fail, self.empty, self.calls = conf, text, fail, empty, []

    def ocr(self, image, iso2t, size):
        self.calls.append((iso2t, size))
        if self.fail:
            raise self.fail
        if self.empty:
            return []
        w = Word(text=self.text, bbox=(0, 0, 1, 1), conf=self.conf)
        return [Block(text=self.text, bbox=(0, 0, 1, 1), words=[] if self.conf is None else [w])]


class Boom(Stub):
    def ocr(self, *a):
        raise AssertionError("OCR must not be called")


def _parse(path, tmp_path, **kw):
    kw.setdefault("local", Stub())
    return parse(path, target_iso639_2t="fra", cache_dir=tmp_path / "cache", **kw)


def test_native_pdf_never_calls_ocr(native_pdf, tmp_path):
    doc = _parse(native_pdf, tmp_path, local=Boom(), remote=Boom())
    assert [p.trust for p in doc.pages] == ["native", "native"]


def test_mixed_pdf_ocrs_only_the_scanned_page(mixed_pdf, tmp_path):
    local = Stub()
    doc = _parse(mixed_pdf, tmp_path, local=local)
    assert [p.source for p in doc.pages] == ["native", "ocr_local"] and len(local.calls) == 1


def test_image_goes_to_ocr(rotated_png, tmp_path):
    doc = _parse(rotated_png, tmp_path)
    assert [p.source for p in doc.pages] == ["ocr_local"] and doc.pages[0].mean_confidence == 0.95


def test_garbled_layer_goes_to_ocr(garbled_pdf, tmp_path):
    assert _parse(garbled_pdf, tmp_path).pages[0].source == "ocr_local"


def test_cache_hit_does_no_work_and_key_covers_inputs(scanned_pdf, tmp_path):
    first, second = Stub(), Boom()
    a = _parse(scanned_pdf, tmp_path, local=first)
    assert _parse(scanned_pdf, tmp_path, local=second) == a      # hit: Boom never runs
    other = Stub()
    parse(scanned_pdf, target_iso639_2t="spa", local=other, cache_dir=tmp_path / "cache")
    assert other.calls                                            # different language: miss
    third = Stub()
    _parse(scanned_pdf, tmp_path, local=third, handwritten=True)
    assert third.calls                                            # handwritten flag: miss
    fourth = Stub()
    _parse(scanned_pdf, tmp_path, local=fourth, remote=Stub(conf=None))
    assert fourth.calls                                           # remote presence: miss


def test_low_confidence_escalates_only_that_page(scanned_pdf, tmp_path):
    class Mixed(Stub):
        def ocr(self, image, iso2t, size):
            self.conf = 0.95 if not self.calls else 0.2
            return super().ocr(image, iso2t, size)
    remote = Stub(conf=None, text="merci")
    doc = _parse(scanned_pdf, tmp_path, local=Mixed(), remote=remote)
    assert len(remote.calls) == 1
    assert [(p.source, p.trust) for p in doc.pages] == [("ocr_local", "ocr"), ("ocr_remote", "llm_transcribed")]


def test_remote_error_keeps_local_with_warning(rotated_png, tmp_path):
    err = ModelAPIError(ModelAPIError.KIND_AUTH, 401, "bad key")
    doc = _parse(rotated_png, tmp_path, local=Stub(conf=0.2), remote=Stub(fail=err))
    page = doc.pages[0]
    assert page.source == "ocr_local" and any("remote" in w.lower() for w in page.warnings)


def test_remote_empty_keeps_local_with_warning(rotated_png, tmp_path):
    page = _parse(rotated_png, tmp_path, local=Stub(conf=0.2), remote=Stub(empty=True)).pages[0]
    assert page.source == "ocr_local" and page.warnings


def test_low_confidence_without_remote_warns(rotated_png, tmp_path):
    page = _parse(rotated_png, tmp_path, local=Stub(conf=0.2)).pages[0]
    assert page.source == "ocr_local" and any("confidence" in w for w in page.warnings)


def test_handwritten_skips_local_when_remote_available(rotated_png, tmp_path):
    doc = _parse(rotated_png, tmp_path, local=Boom(), remote=Stub(conf=None), handwritten=True)
    assert doc.pages[0].source == "ocr_remote"


def test_handwritten_without_remote_warns_and_uses_local(rotated_png, tmp_path):
    doc = _parse(rotated_png, tmp_path, handwritten=True)
    assert doc.pages[0].source == "ocr_local" and any("handwritten" in w for w in doc.warnings)


def test_blank_page_has_no_blocks_and_no_remote_call(blank_png, tmp_path):
    doc = _parse(blank_png, tmp_path, local=Boom(), remote=Boom())
    assert doc.pages[0].blocks == [] and doc.pages[0].warnings


def test_ocr_exception_becomes_empty_page_with_warning(rotated_png, tmp_path):
    page = _parse(rotated_png, tmp_path, local=Stub(fail=RuntimeError("onnx blew up"))).pages[0]
    assert page.blocks == [] and page.warnings


def test_deferred_language_scanned_raises_but_native_parses(native_pdf, scanned_pdf, tmp_path):
    with pytest.raises(ParseError) as e:
        parse(scanned_pdf, target_iso639_2t="rus", local=Stub(), cache_dir=tmp_path / "c")
    assert e.value.code == "ocr_language_unsupported"
    assert parse(native_pdf, target_iso639_2t="rus", local=Boom(), cache_dir=tmp_path / "c").pages


def test_encrypted_pdf_raises(tmp_path):
    doc = pymupdf.open()
    doc.new_page().insert_text((72, 72), "secret " * 20)
    p = tmp_path / "enc.pdf"
    doc.save(p, encryption=pymupdf.PDF_ENCRYPT_AES_256, user_pw="u", owner_pw="o")
    with pytest.raises(ParseError) as e:
        _parse(p, tmp_path)
    assert e.value.code == "encrypted"


@pytest.mark.parametrize("name,data,code", [
    ("bad.pdf", b"not a pdf at all", "corrupt"),
    ("bad.png", b"not a png", "corrupt"),
    ("notes.txt", b"hello", "unsupported"),
])
def test_bad_inputs_raise_typed_errors(tmp_path, name, data, code):
    p = tmp_path / name
    p.write_bytes(data)
    with pytest.raises(ParseError) as e:
        _parse(p, tmp_path)
    assert e.value.code == code


def test_too_many_pages_raises_before_rendering(scanned_pdf, tmp_path, monkeypatch):
    monkeypatch.setattr(pipeline, "MAX_PAGES", 1)
    monkeypatch.setattr(pipeline, "_render", lambda *a: pytest.fail("rendered"))
    with pytest.raises(ParseError) as e:
        _parse(scanned_pdf, tmp_path)
    assert e.value.code == "too_many_pages"


def test_too_large_file_raises(scanned_pdf, tmp_path, monkeypatch):
    monkeypatch.setattr(pipeline, "MAX_FILE_BYTES", 10)
    with pytest.raises(ParseError) as e:
        _parse(scanned_pdf, tmp_path)
    assert e.value.code == "too_large"


@pytest.mark.ocr
def test_real_engine_end_to_end_on_rotated_image(rotated_png, tmp_path):
    doc = parse(rotated_png, target_iso639_2t="fra", cache_dir=tmp_path / "c")
    text = " ".join(b.text for b in doc.pages[0].blocks).lower()
    assert "bonjour" in text and doc.pages[0].trust == "ocr"


def test_oversized_pdf_page_is_rejected_before_rendering(scanned_pdf, tmp_path, monkeypatch):
    monkeypatch.setattr(pipeline, "MAX_PAGE_PIXELS", 1_000_000)
    monkeypatch.setattr(pipeline, "_render", lambda *a: pytest.fail("rendered"))
    with pytest.raises(ParseError) as e:
        _parse(scanned_pdf, tmp_path)
    assert e.value.code == "too_large"


def test_oversized_image_is_rejected_before_decoding(tmp_path, monkeypatch):
    from PIL import Image
    p = tmp_path / "big.png"
    Image.new("L", (2000, 1000), 255).save(p)
    monkeypatch.setattr(pipeline, "MAX_PAGE_PIXELS", 1_000_000)
    monkeypatch.setattr(pipeline.cv2, "imdecode", lambda *a: pytest.fail("decoded"))
    with pytest.raises(ParseError) as e:
        _parse(p, tmp_path)
    assert e.value.code == "too_large"


def test_failed_remote_result_is_not_cached(rotated_png, tmp_path):
    err = ModelAPIError(ModelAPIError.KIND_CONNECT, None, "timeout")
    first = _parse(rotated_png, tmp_path, local=Stub(conf=0.2), remote=Stub(fail=err))
    assert first.pages[0].source == "ocr_local"
    second = _parse(rotated_png, tmp_path, local=Stub(conf=0.2), remote=Stub(conf=None))
    assert second.pages[0].source == "ocr_remote"          # retried, not served from cache


def test_local_ocr_crash_is_not_cached(rotated_png, tmp_path):
    _parse(rotated_png, tmp_path, local=Stub(fail=RuntimeError("boom")))
    second = _parse(rotated_png, tmp_path, local=Stub())
    assert second.pages[0].blocks


def test_cache_key_distinguishes_remote_endpoints(rotated_png, tmp_path):
    a, b = Stub(conf=None), Stub(conf=None)
    a.cache_id, b.cache_id = "https://a/v1|vision-a", "https://b/v1|vision-b"
    _parse(rotated_png, tmp_path, local=Stub(conf=0.2), remote=a)
    _parse(rotated_png, tmp_path, local=Stub(conf=0.2), remote=b)
    assert a.calls and b.calls                    # user B's endpoint is not skipped by A's cached result
    again = Stub(conf=None)
    again.cache_id = a.cache_id
    _parse(rotated_png, tmp_path, local=Boom(), remote=again)
    assert not again.calls                        # same endpoint and model: cache hit


def test_remote_engine_cache_id_excludes_the_api_key():
    from lapp.services.parsing.ocr import RemoteOcrEngine
    e = RemoteOcrEngine({"base_url": "https://x/v1", "api_key": "SECRET", "model": "m", "api_format": "openai"})
    assert e.cache_id == "https://x/v1|m" and "SECRET" not in e.cache_id
