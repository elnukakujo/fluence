"""Tatoeba-first examples: hits without any endpoint, whole words, translations, attribution, failure memory, loader."""
import sys
from datetime import datetime, timedelta
from pathlib import Path

import lapp.services  # noqa: F401
from lapp.models.system_data import CorpusLink, CorpusSentence, FailureMemory
from lapp.services import corpus

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))


def _seed(db):
    with db.session_scope() as s:
        for i, lang, text in [(1, "fra", "Le chat dort sur le canapé."), (2, "eng", "The cat sleeps on the couch."),
                              (3, "fra", "Un chat noir traverse la rue très lentement ce soir."), (4, "fra", "Ce chatelain est riche."),
                              (5, "jpn", "私は猫が好きです。"), (6, "eng", "I like cats.")]:
            s.add(CorpusSentence(id=i, lang=lang, text=text))
        s.add_all([CorpusLink(sentence_id=1, translation_id=2), CorpusLink(sentence_id=2, translation_id=1),
                   CorpusLink(sentence_id=5, translation_id=6)])


def test_corpus_hit_needs_no_endpoint_and_carries_attribution_and_translation(db):
    _seed(db)
    out = corpus.examples_for("chat", "fr", limit=2, source_iso1="en")
    assert [o["text"] for o in out] == ["Le chat dort sur le canapé.", "Un chat noir traverse la rue très lentement ce soir."]  # shortest first, "chatelain" excluded
    assert out[0]["translation"] == "The cat sleeps on the couch." and out[1]["translation"] == ""
    assert all(o["source"] == "tatoeba" and "Tatoeba" in o["attribution"] for o in out)


def test_scripts_without_spaces_match_as_substring_and_unknowns_are_empty(db):
    _seed(db)
    assert corpus.examples_for("猫", "ja", source_iso1="en")[0]["translation"] == "I like cats."
    assert corpus.examples_for("zzz", "fr") == []
    assert corpus.examples_for("", "fr") == []


def test_an_empty_result_is_remembered_inside_the_window_only(db):
    assert not corpus.recently_failed("example", "voc_V1")
    corpus.remember_failure("example", "voc_V1")
    assert corpus.recently_failed("example", "voc_V1")
    corpus.remember_failure("example", "voc_V1")                       # again: one row, refreshed
    with db.session_scope() as s:
        rows = s.query(FailureMemory).all()
        assert len(rows) == 1
        rows[0].failed_at = datetime.now() - timedelta(days=corpus.EXAMPLE_RETRY_DAYS + 1)
    assert not corpus.recently_failed("example", "voc_V1")


def test_loader_keeps_only_supported_languages_and_their_links(db, tmp_path):
    from load_tatoeba import load
    (tmp_path / "sentences.csv").write_text("1\tfra\tBonjour\n2\teng\tHello\n3\trus\tПривет\n", encoding="utf-8")
    (tmp_path / "links.csv").write_text("1\t2\n2\t1\n1\t3\n", encoding="utf-8")
    assert load(str(tmp_path)) == (2, 2)
    assert corpus.examples_for("Bonjour", "fr", source_iso1="en")[0]["translation"] == "Hello"
