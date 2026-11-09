"""Helpers for review tests."""

def link_all_exercises(db, user_id="user_U1"):
    """The daily review only holds exercises whose linked elements are known a little: link every exercise to one scored
    vocabulary that lives in another language, so the reviewed queues themselves don't change."""
    from lapp.models.components import Word
    from lapp.models.containers import Language, Lesson
    from lapp.models.features import Exercise, Vocabulary
    from lapp.services.system_data import ScoreService
    with db.session_scope() as s:
        if s.get(Vocabulary, "voc_LINK") is None:
            db.insert(Language(id="lang_LINK", user_id=user_id, name="X", target_iso639_2t="jpn"), session=s, commit=False)
            db.insert(Lesson(id="lesson_LINK", user_id=user_id, language_id="lang_LINK", title="X", position=0), session=s, commit=False)
            db.insert(Word(id="word_LINK", language_id="lang_LINK", word="x"), session=s, commit=False)
            db.insert(Vocabulary(id="voc_LINK", lesson_id="lesson_LINK", word_id="word_LINK"), session=s, commit=False)
            s.flush()
        voc = s.get(Vocabulary, "voc_LINK")
        for ex in s.query(Exercise).all():
            if voc not in ex.related_vocabulary:
                ex.related_vocabulary.append(voc)
    ScoreService().set(user_id, "voc_LINK", 50.0, 0.5)
