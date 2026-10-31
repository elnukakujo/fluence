from lapp.services.ingestion import elements as el
from lapp.services.ingestion.media import image_crop, quote_region, render_crop
from lapp.services.ingestion.types import Chunk
from lapp.services.parsing.types import Page, Word


def _chunk():
    words = [Word(text="Look", bbox=(10, 100, 40, 112)), Word(text="at", bbox=(45, 100, 60, 112)), Word(text="this", bbox=(65, 100, 95, 112)),
             Word(text="Then", bbox=(10, 300, 40, 312)), Word(text="answer", bbox=(45, 300, 90, 312))]
    return Chunk(id="p0c0", page=0, text="Look at this\nThen answer", trust="native", words=words)


def _page(images):
    return Page(index=0, width=200, height=400, source="native", trust="native", images=images)


def test_quote_region_is_the_box_of_the_words_that_spell_the_quote():
    assert quote_region(_chunk(), "Then answer") == [10, 300, 90, 312]
    assert quote_region(_chunk(), "not on the page")[1] == 100          # falls back to the chunk's words


def test_a_picture_beside_the_item_is_included_and_a_far_one_is_not():
    crop = image_crop(_page([(100, 90, 190, 180)]), _chunk(), "Look at this")
    assert crop["has_picture"] and crop["bbox"][2] >= 190 and crop["page"] == 0 and crop["page_size"] == [200, 400]
    assert image_crop(_page([(100, 90, 190, 180)]), _chunk(), "Then answer") is None      # 120 away
    assert image_crop(_page([]), _chunk(), "Look at this") is None
    assert image_crop(_page([(0, 0, 200, 400)]), _chunk(), "Look at this") is None        # a full-page background is not a picture


def test_render_crop_cuts_the_region_out_of_a_real_pdf(tmp_path):
    import pymupdf
    pdf = tmp_path / "d.pdf"
    doc = pymupdf.open()
    doc.new_page(width=200, height=400).insert_text((20, 120), "hello")
    doc.save(pdf)
    png = render_crop(pdf, {"page": 0, "bbox": [0, 100, 100, 140], "page_size": [200, 400]})
    assert png and png.startswith(b"\x89PNG")
    assert render_crop(tmp_path / "missing.pdf", {"page": 0, "bbox": [0, 0, 1, 1], "page_size": [1, 1]}) is None


def test_audio_lines_for_conversation_speaking_and_listening():
    chunk = Chunk(id="c", page=0, text="Practise 你好吗? 我很好。 Say 你好 Listen and answer", trust="native")
    conv = {"exercise_type": "conversation", "question": "Practise", "answer": None, "quote": "Practise", "content": {
        "speakers": [{"name": "A", "is_learner": False}, {"name": "You", "is_learner": True}],
        "lines": [{"speaker": "A", "text": "你好吗?"}, {"speaker": "You", "text": "我很好。"}]}}
    assert el.verify_element("exercise", conv, chunk, "zh").audio_lines == ["你好吗?", "我很好。"]
    say = {"exercise_type": "speaking", "question": "Say 你好", "quote": "Say", "answer": None, "content": None}
    assert el.verify_element("exercise", say, chunk, "zh").audio_lines == ["Say 你好"]
    listen = {"exercise_type": "answering", "question": "Listen and answer", "answer": "x", "quote": "Listen", "content": None, "listening_text": "你好吗"}
    c = el.verify_element("exercise", listen, chunk, "zh")
    assert c.audio_lines == ["你好吗"] and any(f.code == "listening_inferred" for f in c.flags)
    plain = {**listen, "listening_text": None}
    assert el.verify_element("exercise", plain, chunk, "zh").audio_lines == []
