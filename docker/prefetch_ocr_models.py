"""Build-time: download the Korean OCR recognizer (the other RapidOCR models ship in the wheel)."""
import numpy as np
from PIL import Image, ImageDraw
from rapidocr import LangRec, ModelType, OCRVersion, RapidOCR

im = Image.new("RGB", (200, 60), "white")
ImageDraw.Draw(im).text((10, 20), "OCR 123", fill="black")
RapidOCR(params={
    "Rec.ocr_version": OCRVersion("PP-OCRv5"),
    "Rec.model_type": ModelType("mobile"),
    "Rec.lang_type": LangRec("korean"),
})(np.array(im))
