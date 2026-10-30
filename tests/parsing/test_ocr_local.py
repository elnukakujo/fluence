import numpy as np
import pytest
from PIL import Image, ImageDraw, ImageFont

from lapp.services.parsing.ocr import RapidOcrEngine
from lapp.services.parsing.types import ParseError

pytestmark = pytest.mark.ocr

LAT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
CJK = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"


def _line(text, font):
    im = Image.new("RGB", (900, 140), "white")
    ImageDraw.Draw(im).text((20, 30), text, font=ImageFont.truetype(font, 56), fill="black")
    return np.array(im)[:, :, ::-1]  # BGR


@pytest.fixture(scope="module")
def engine():
    return RapidOcrEngine()


def test_reads_french_line_with_confidence(engine):
    blocks = engine.ocr(_line("café élève", LAT), "fra", (900, 140))
    text = " ".join(b.text for b in blocks)
    assert "café" in text and "élève" in text
    words = [w for b in blocks for w in b.words]
    assert words and all(0 <= w.conf <= 1 for w in words)


def test_bboxes_are_scaled_to_page_size(engine):
    blocks = engine.ocr(_line("café élève", LAT), "fra", (450, 70))
    assert all(b.bbox[2] <= 450 and b.bbox[3] <= 70 for b in blocks)


def test_reads_hangul_with_the_korean_recognizer(engine):
    blocks = engine.ocr(_line("나는 학생입니다", CJK), "kor", (900, 140))
    assert "학생입니다" in " ".join(b.text for b in blocks)


def test_latin_chinese_japanese_share_one_model(engine):
    assert engine._model_for("fra") is engine._model_for("jpn") is engine._model_for("zho")
    assert engine._model_for("kor") is not engine._model_for("fra")


def test_deferred_language_is_refused(engine):
    with pytest.raises(ParseError) as e:
        engine.ocr(_line("привет", LAT), "rus", (900, 140))
    assert e.value.code == "ocr_language_unsupported"


def test_cjk_and_latin_text_keep_the_engines_own_spacing(engine):
    """Word boxes are per character for CJK; the block text must not gain spaces between them."""
    blocks = engine.ocr(_line("我是学生 hello world", CJK), "zho", (900, 140))
    text = " ".join(b.text for b in blocks)
    assert "我是学生" in text and "hello world" in text


def test_blocks_are_detector_boxes_and_lose_no_words(engine):
    """The detector may split short Latin text at word gaps; every word must still appear once, in order."""
    blocks = engine.ocr(_line("bonjour le monde", LAT), "fra", (900, 140))
    assert " ".join(b.text for b in blocks) == "bonjour le monde"
    assert [w.text for b in blocks for w in b.words] == ["bonjour", "le", "monde"]
