"""RE-15: among a lesson's exercises, the ones that train the cards due in this review come first, unlinked ones last."""
from types import SimpleNamespace as NS

from lapp.services.features.review_queue import exercise_rank


def _ex(vocab=(), grammar=(), call=()):
    wrap = lambda ids: [NS(id=i) for i in ids]
    return NS(related_vocabulary=wrap(vocab), related_grammar=wrap(grammar), related_calligraphy=wrap(call))


def test_overlap_then_other_links_then_unlinked():
    due = {"voc_V1", "gram_G2"}
    exercises = {"unlinked": _ex(), "other": _ex(vocab=["voc_V9"]), "voc": _ex(vocab=["voc_V1"]), "gram": _ex(grammar=["gram_G2"], vocab=["voc_V9"])}
    ordered = sorted(exercises, key=lambda k: exercise_rank(exercises[k], due))
    assert ordered[:2] == ["voc", "gram"] and ordered[2:] == ["other", "unlinked"]
