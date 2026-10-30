"""Generated fixture files; nothing binary is committed."""
import pymupdf
import pytest
from PIL import Image, ImageDraw, ImageFont

LAT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
CJK = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
A4 = pymupdf.paper_rect("a4")


def text_image(lines, size=(1240, 1754), font_size=44, font=LAT, angle=0.0) -> Image.Image:
    im = Image.new("RGB", size, "white")
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(font, font_size)
    for i, line in enumerate(lines):
        d.text((100, 120 + i * font_size * 2), line, font=f, fill="black")
    return im.rotate(angle, expand=False, fillcolor="white") if angle else im


def _png_bytes(im: Image.Image) -> bytes:
    import io
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue()


def _native_page(doc, heading, body_lines):
    page = doc.new_page(width=A4.width, height=A4.height)
    page.insert_text((72, 100), heading, fontsize=24, fontname="helv")
    page.insert_text((72, 150), "\n".join(body_lines), fontsize=11, fontname="helv", lineheight=1.5)
    return page


def _image_page(doc, lines):
    page = doc.new_page(width=A4.width, height=A4.height)
    page.insert_image(page.rect, stream=_png_bytes(text_image(lines)))
    return page


BODY = ["This is a paragraph of ordinary running text that fills the page nicely."] * 6
VOCAB = ["apple - manzana", "house - casa", "water - agua", "book - libro"]


@pytest.fixture(scope="session")
def native_pdf(tmp_path_factory):
    doc = pymupdf.open()
    _native_page(doc, "Lesson One", BODY)
    _native_page(doc, "Vocabulary", VOCAB)
    p = tmp_path_factory.mktemp("fx") / "native.pdf"
    doc.save(p)
    return p


@pytest.fixture(scope="session")
def scanned_pdf(tmp_path_factory):
    doc = pymupdf.open()
    _image_page(doc, ["bonjour le monde", "café élève"])
    _image_page(doc, ["merci beaucoup"])
    p = tmp_path_factory.mktemp("fx") / "scanned.pdf"
    doc.save(p)
    return p


@pytest.fixture(scope="session")
def garbled_pdf(tmp_path_factory):
    doc = pymupdf.open()
    page = _image_page(doc, ["bonjour le monde"])
    # invisible text layer of replacement characters, as left by a failed earlier OCR
    page.insert_text((72, 100), "�" * 300, fontsize=11, fontfile=LAT, fontname="dj", render_mode=3)
    p = tmp_path_factory.mktemp("fx") / "garbled.pdf"
    doc.save(p)
    return p


@pytest.fixture(scope="session")
def mixed_pdf(tmp_path_factory):
    doc = pymupdf.open()
    _native_page(doc, "Lesson One", BODY)
    _image_page(doc, ["merci beaucoup"])
    p = tmp_path_factory.mktemp("fx") / "mixed.pdf"
    doc.save(p)
    return p


@pytest.fixture(scope="session")
def cjk_pdf(tmp_path_factory):
    doc = pymupdf.open()
    page = doc.new_page(width=A4.width, height=A4.height)
    page.insert_text((72, 100), "\n".join(["我是学生。" * 6] * 10), fontsize=12, fontfile=CJK, fontname="cjk")
    p = tmp_path_factory.mktemp("fx") / "cjk.pdf"
    doc.save(p)
    return p


@pytest.fixture(scope="session")
def rotated_png(tmp_path_factory):
    p = tmp_path_factory.mktemp("fx") / "rotated.png"
    text_image(["bonjour le monde", "café élève", "merci beaucoup"], angle=7).save(p)
    return p


@pytest.fixture(scope="session")
def blank_png(tmp_path_factory):
    p = tmp_path_factory.mktemp("fx") / "blank.png"
    Image.new("RGB", (800, 600), "white").save(p)
    return p


@pytest.fixture(scope="session")
def image_then_text_pdf(tmp_path_factory):
    """An image block precedes the text blocks, which shifts block numbering."""
    doc = pymupdf.open()
    page = doc.new_page(width=A4.width, height=A4.height)
    page.insert_image(pymupdf.Rect(72, 40, 172, 90), stream=_png_bytes(text_image(["logo"], size=(200, 100))))
    page.insert_text((72, 200), "alpha beta gamma delta " * 4, fontsize=11)
    page.insert_text((72, 400), "apple manzana casa libro " * 4, fontsize=11)
    p = tmp_path_factory.mktemp("fx") / "image_then_text.pdf"
    doc.save(p)
    return p


@pytest.fixture(scope="session")
def searchable_scan_pdf(tmp_path_factory):
    """A scan with a third party's invisible OCR text layer on top (render mode 3)."""
    doc = pymupdf.open()
    page = _image_page(doc, ["bonjour le monde"])
    page.insert_text((72, 100), "\n".join(["bonjour le monde et merci beaucoup"] * 40), fontsize=11, render_mode=3)
    p = tmp_path_factory.mktemp("fx") / "searchable.pdf"
    doc.save(p)
    return p
