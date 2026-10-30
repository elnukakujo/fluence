import cv2
import numpy as np

from lapp.services.parsing.preprocess import preprocess


def _skew_degrees(binary: np.ndarray) -> float:
    """Independent estimate: the angle whose row projection is sharpest."""
    ink = (binary < 128).astype(np.uint8)
    h, w = ink.shape
    best, best_score = 0.0, -1.0
    for a in np.arange(-12, 12.5, 0.5):
        m = cv2.getRotationMatrix2D((w / 2, h / 2), a, 1.0)
        score = np.var(cv2.warpAffine(ink, m, (w, h)).sum(axis=1))
        if score > best_score:
            best, best_score = a, score
    return best


def test_deskew_reduces_angle(rotated_png):
    img = cv2.imread(str(rotated_png))
    before = abs(_skew_degrees(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)))
    after = abs(_skew_degrees(preprocess(img)))
    assert before >= 5 and after <= 1.0


def test_output_is_binary_single_channel(rotated_png):
    out = preprocess(cv2.imread(str(rotated_png)))
    assert out.ndim == 2 and out.dtype == np.uint8
    assert set(np.unique(out)) <= {0, 255}


def test_blank_image_is_stable(blank_png):
    out = preprocess(cv2.imread(str(blank_png)))
    assert out.shape == (600, 800) and (out == 255).all()
