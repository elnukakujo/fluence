from ingestion_seeds import client_for, make_language, make_user
from lapp.models.features import Exercise
from lapp.services.ingestion.exercises import link_to_elements
from lapp.services.ingestion.jobs import IngestionJobService

VOC = [("voc_V1", "bonjour"), ("voc_V2", "chat")]
GRAM = [("gram_G1", "Present tense")]
CALL = [("call_C1", "中")]


def test_an_exercise_links_every_element_it_mentions():
    fields = {"question": "Say Bonjour in the present tense", "answer": "", "text_support": None, "content": None}
    assert link_to_elements(fields, VOC, GRAM, CALL) == {"related_vocabulary": ["voc_V1"], "related_grammar": ["gram_G1"], "related_calligraphy": []}
    fields = {"question": "Which is 中?", "answer": "chat", "text_support": None, "content": {"options": ["chat"], "correct": [0]}}
    out = link_to_elements(fields, VOC, GRAM, CALL)
    assert out["related_vocabulary"] == ["voc_V2"] and out["related_calligraphy"] == ["call_C1"]


def test_an_unrelated_exercise_links_nothing():
    out = link_to_elements({"question": "Describe your day", "answer": "x", "text_support": None, "content": None}, VOC, GRAM, CALL)
    assert out == {"related_vocabulary": [], "related_grammar": [], "related_calligraphy": []}


def _accept(app, db, media_root, elements):
    make_user(db, "user_U1")
    make_language(db, "user_U1")
    client = client_for(app, "user_U1")
    job_id = client.post("/api/ingestion", data={"language_id": "lang_L1", "file": (__import__("io").BytesIO(b"%PDF-1.4"), "n.pdf")},
                         content_type="multipart/form-data").get_json()["job_id"]
    IngestionJobService().update(job_id, status="ready")
    return client.post(f"/api/ingestion/{job_id}/accept", json={"lesson_id": "lesson_L1", "items": [{"word": "hello"}], "elements": elements})


def _ex(question):
    return {"kind": "exercise", "fields": {"exercise_type": "answering", "question": question, "answer": "A", "text_support": None, "content": None}}


def test_accept_links_an_exercise_to_the_vocabulary_and_grammar_of_the_same_import(app, db, media_root, scheduled):
    grammar = {"kind": "grammar", "fields": {"title": "Greeting", "explanation": "Used to greet", "example_sentences": []}}
    res = _accept(app, db, media_root, [_ex("Use Greeting with hello"), grammar])   # exercise listed before the grammar it needs
    assert res.status_code == 200
    with db.session_scope() as s:
        ex = s.query(Exercise).filter(Exercise.lesson_id == "lesson_L1").one()
        assert [v.id for v in ex.related_vocabulary] and [g.title for g in ex.related_grammar] == ["Greeting"]


def test_accept_does_not_store_an_exercise_that_matches_no_element(app, db, media_root, scheduled):
    res = _accept(app, db, media_root, [_ex("Describe your day")])
    body = res.get_json()
    assert res.status_code == 200 and body["created_elements"] == 0
    assert any("matches no element" in n for n in body["notes"])
    with db.session_scope() as s:
        assert s.query(Exercise).count() == 0
