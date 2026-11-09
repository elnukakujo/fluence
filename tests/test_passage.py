import pytest

from lapp.utils.passage import is_passage


@pytest.mark.parametrize("text", ["chat", "thank you very much", "ça va", "你好", "食べ物", "Mr. Smith", "成语四字", ""])
def test_words_and_short_phrases_are_not_passages(text):
    assert not is_passage(text)


@pytest.mark.parametrize("text", ["Where is the train station today?", "I like it.", "我今天想去很远的地方看看朋友", "我喜欢你。", "毎日学校へ行きます。"])
def test_sentences_are_passages(text):
    assert is_passage(text)


def test_word_type_tag_wins():
    assert is_passage("chat", "sentence")
    assert not is_passage("chat", "noun")
