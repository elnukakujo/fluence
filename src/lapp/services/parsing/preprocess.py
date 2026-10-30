"""Clean a page image before OCR: grayscale, denoise, deskew, adaptive threshold."""
import cv2
import numpy as np

MIN_INK_PIXELS = 50   # below this the page is treated as blank: no skew estimate, no rotation


def _deskew(gray: np.ndarray) -> np.ndarray:
    ys, xs = np.where(gray < 128)
    if len(xs) < MIN_INK_PIXELS:
        return gray
    angle = cv2.minAreaRect(np.column_stack((xs, ys)).astype(np.float32))[-1]
    angle = angle - 90 if angle > 45 else angle   # minAreaRect reports (0, 90]
    if abs(angle) < 0.1:
        return gray
    h, w = gray.shape
    m = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    return cv2.warpAffine(gray, m, (w, h), flags=cv2.INTER_CUBIC, borderValue=255)


def preprocess(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    gray = cv2.fastNlMeansDenoising(gray, None, h=10)
    gray = _deskew(gray)
    return cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 15)
