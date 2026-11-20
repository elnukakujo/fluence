import pytest

from lapp.services.exercise_generation.checks import code_error, is_near_duplicate
from lapp.services.ingestion import elements as el

IDS = {"voc_V1", "gram_G1"}


def item(t, content=None, question="Q?", answer="A", links=("voc_V1",)):
    return {"exercise_type": t, "question": question, "answer": answer, "content": content, "links": list(links)}


GOOD = [
    item("essay"), item("answering"), item("translate", question="I am a student.", answer="我是学生。"), item("translate", question="Je suis étudiant.", answer="I am a student."), item("translate", question="我每天坐火车去工作。", answer="Je vais au travail en train."),
    item("answering", question="这个家有几口人？", answer="这个家有三口人。"),
    item("speaking", question="他会游泳。", answer=""),
    {**item("type_in_the_blank", {"segments": ["He ", " tall."], "blanks": [{"answer": "is"}]}), "text_support": "be"},
    item("select_in_the_blank", {"segments": ["He ", " tall."], "blanks": [{"answer": "is", "options": ["is", "are"]}]}),
    item("quizz", {"options": ["a", "b"], "correct": [1]}),
    item("matching", {"pairs": [["a", "1"], ["b", "2"]]}),
    item("true_false", {"statement": "s", "answer": True}),
    item("organize", {"items": ["I", "drink", "water"], "answer_order": [0, 1, 2]}),
]


@pytest.mark.parametrize("good", GOOD, ids=lambda g: g["exercise_type"])
def test_a_good_item_passes(good):
    assert code_error(good, IDS) is None


@pytest.mark.parametrize("bad,why", [
    (item("quizz", {"options": ["a", "b"], "correct": [2]}), "content"),
    (item("type_in_the_blank", {"segments": ["x ", " y"], "blanks": [{"answer": " "}]}), "content"),
    (item("matching", {"pairs": [["a", "1"], ["a", "1"]]}), "duplicate"),
    (item("matching", {"pairs": [["a", "1"], ["a", "2"]]}), "duplicate"),
    (item("answering", answer=" "), "answer"),
    (item("essay", links=()), "link"),
    (item("essay", links=("voc_other",)), "link"),
    (item("poem"), "type"),
    (item("essay", question=" "), "question"),
    (item("translate", question="Complete: 我___学生。 (I am a student)", answer="是"), "translate"),   # a gap dressed as a translate
    (item("translate", question="I am a student.", answer="是"), "translate answer"),                 # one word to a whole sentence
    (item("translate", question="Fill in the missing word: I am a student.", answer="我是学生"), "translate"),
    (item("speaking", question="Imagine your brother. Say: 'He can swim.' Use 会 to express ability.", answer=""), "speaking"),
    (item("essay", question="Fill the gap: I get up at seven. 我七点___起床。"), "essay"),     # the model's essay that was a gap
    (item("answering", question="Complete: 他___学生。", answer="他是学生。"), "answering"),
    (item("speaking", question="Say: 他会游泳。", answer=""), "speaking"),
    (item("speaking", question="他___游泳。", answer=""), "speaking"),
    (item("conversation", {"speakers": [{"name": "A", "is_learner": False}, {"name": "B", "is_learner": True}],
                           "lines": [{"speaker": "A", "text": "你好吗？"}, {"speaker": "B", "text": "我看___了，很好。"}]}), "gap"),
    (item("reading", {"speakers": [{"name": "A"}], "lines": [{"speaker": "A", "text": "我是__"}]}), "gap"),
])
def test_each_rule_rejects_a_broken_item(bad, why):
    assert why in (code_error(bad, IDS) or "").lower()


def test_reading_and_dictation_may_have_no_instruction():
    reading = {"speakers": [{"name": "A"}], "lines": [{"speaker": "A", "text": "hi"}]}
    assert code_error(item("reading", reading, question=""), IDS) is None
    assert code_error(item("dictation", {"lines": [{"text": "hi"}]}, question=""), IDS) is None
    assert "question" in (code_error(item("essay", question=""), IDS) or "")


def test_near_duplicates_are_found_by_normalised_text_and_similarity():
    kept = [item("essay", question="Translate the word cat.")]
    assert is_near_duplicate(item("essay", question="translate the word  CAT"), kept)
    assert is_near_duplicate(item("essay", question="Translate the word cat!"), kept)
    assert not is_near_duplicate(item("essay", question="Describe your day."), kept)


def test_stored_content_matches_what_verify_element_stores():
    reading = {"speakers": [{"name": "A"}], "lines": [{"speaker": "A", "text": " hi ", "translation": None}]}
    assert el.stored_content("reading", reading)["lines"][0]["audioIndex"] is None
    assert el.stored_content("dictation", {"lines": [{"text": " x "}]}) == {"lines": [{"text": "x", "audioIndex": None}]}
    assert el.stored_content("conversation", {"speakers": []}) is None
    assert el.stored_content("quizz", {"options": ["a"], "correct": [0]}) == {"options": ["a"], "correct": [0]}


def test_a_type_in_gap_without_a_clue_is_rejected():
    bare = item("type_in_the_blank", {"segments": ["I like to drink ", "."], "blanks": [{"answer": "water"}]})
    assert "clue" in code_error(bare, IDS)
    assert code_error({**bare, "text_support": "water, coke, beer"}, IDS) is None


def test_an_open_ended_essay_needs_no_answer_but_a_translation_does():
    assert code_error(item("essay", answer=""), IDS) is None
    assert code_error(item("translate", answer=""), IDS) == "the answer is empty"


def test_links_without_a_grammar_of_the_slot_are_rejected():
    why = code_error(item("essay", links=("voc_V1",)), IDS, {"gram_G1"})
    assert why and "grammar" in why


def test_links_with_the_grammar_pass():
    assert code_error(item("essay", links=("gram_G1", "voc_V1")), IDS, {"gram_G1"}) is None


def test_a_slot_without_grammar_has_nothing_to_require():
    assert code_error(item("essay", links=("voc_V1",)), IDS, set()) is None
