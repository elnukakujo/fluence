from lapp.utils import enrich_components as ec


def _stub(monkeypatch):
    monkeypatch.setattr(ec, "get_phonetic", lambda *a: "")
    monkeypatch.setattr(ec, "translate", lambda *a: "t")
    monkeypatch.setattr(ec, "get_characters", lambda *a: [])
    monkeypatch.setattr(ec, "get_word_type", lambda *a: "noun")
    monkeypatch.setattr(ec, "get_gender", lambda *a: "masc")


def test_sentence_gets_sentence_type_and_no_gender(monkeypatch):
    _stub(monkeypatch)
    r = ec.enrich_word("Where is the train station today?", "en", "fr", "x")
    assert r["word_type"] == "sentence" and r["word_gender"] == ""


def test_word_keeps_its_part_of_speech_and_gender(monkeypatch):
    _stub(monkeypatch)
    r = ec.enrich_word("chat", "fr", "en", "x")
    assert r["word_type"] == "noun" and r["word_gender"] == "masc"
