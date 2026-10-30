import pytest

from lapp.services.parsing.ocr import DEFERRED_ISO1, RECOGNIZERS, SCRIPT_BY_ISO1, script_for
from lapp.services.parsing.types import ParseError
from lapp.utils.detect_language import _LANGUAGES


@pytest.mark.parametrize("iso1", sorted(_LANGUAGES))
def test_every_app_language_is_mapped_or_deferred(iso1):
    mapped, deferred = iso1 in SCRIPT_BY_ISO1, iso1 in DEFERRED_ISO1
    assert mapped != deferred, (
        f"{_LANGUAGES[iso1].name} ({iso1}) must be in exactly one of SCRIPT_BY_ISO1 "
        "(with a recognizer family) or DEFERRED_ISO1"
    )


def test_tables_only_name_known_languages_and_recognizers():
    assert set(SCRIPT_BY_ISO1) | DEFERRED_ISO1 <= set(_LANGUAGES)
    assert set(SCRIPT_BY_ISO1.values()) <= set(RECOGNIZERS)


@pytest.mark.parametrize("iso2t", ["rus", "ukr", "mkd", "ell"])
def test_deferred_language_raises(iso2t):
    with pytest.raises(ParseError) as e:
        script_for(iso2t)
    assert e.value.code == "ocr_language_unsupported"


def test_script_for_in_scope_and_unknown():
    assert [script_for(c) for c in ("fra", "jpn", "kor", "zho")] == ["latin", "japan", "korean", "ch"]
    assert script_for("") is None and script_for(None) is None and script_for("xxx") is None
