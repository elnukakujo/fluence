from typing import Optional, Type

def resolve_element_model(element_id: str) -> Optional[Type]:
        """Map an element id string to the corresponding ORM model.
        
        ID Format:
        - Language: "lang_L{n}"
        - Lesson: "lesson_L{n}"
        - Vocabulary: "voc_V{n}"
        - Grammar: "gram_G{n}"
        - Calligraphy: "call_C{n}"
        - Exercise: "ex_E{n}"
        - Character: "char_C{n}"
        - Word: "word_W{n}"
        - Passage: "pass_P{n}"
        """
        from ..models.features import Vocabulary, Grammar, Calligraphy, Exercise
        from ..models.components import Word, Passage, Character
        from ..models.containers import Language, Lesson
        from ..models.system_data import Tag, Source, User, UserPreferences
        from ..models.data_collection import ProgressTracking
        model_map = {
            "lang": Language,
            "lesson": Lesson,
            "voc": Vocabulary,
            "gram": Grammar,
            "call": Calligraphy,
            "ex": Exercise,
            "char": Character,
            "word": Word,
            "pass": Passage,
            "user": User,
            "pref": UserPreferences,
            "src": Source,
            "tag": Tag,
            "pt": ProgressTracking,
        }
        return model_map.get(element_id.split("_")[0])


def resolve_element_labels(session, element_ids: list) -> dict:
    """Batch-resolve a display label per element id, one query per type.

    Source/Tag detail serialization returns element *ids*; the client used to
    fetch each element back individually (N+1). This resolves a single display
    label per id in one query per element type (≤6) so the client needs no
    follow-up calls. Returns {id: label}.
    """
    from collections import defaultdict
    from sqlalchemy import select
    from sqlalchemy.orm import joinedload
    from ..models.features import Vocabulary, Grammar, Calligraphy, Exercise
    from ..models.containers import Language, Lesson

    buckets = defaultdict(list)
    for id_ in element_ids:
        buckets[id_.split("_")[0]].append(id_)

    # prefix -> (model, load option, label accessor)
    resolvers = {
        "voc":    (Vocabulary, joinedload(Vocabulary.word), lambda v: v.word.word if v.word else None),
        "call":   (Calligraphy, joinedload(Calligraphy.character), lambda c: c.character.character if c.character else None),
        "gram":   (Grammar, None, lambda g: g.title),
        "ex":     (Exercise, None, lambda e: e.question),
        "lesson": (Lesson, None, lambda l: l.title),
        "lang":   (Language, None, lambda l: l.name),
    }

    labels: dict = {}
    for prefix, ids in buckets.items():
        resolver = resolvers.get(prefix)
        if not resolver:
            continue
        model, load, accessor = resolver
        stmt = select(model).where(model.id.in_(ids))
        if load is not None:
            stmt = stmt.options(load)
        for obj in session.execute(stmt).scalars():
            labels[obj.id] = accessor(obj)
    return labels