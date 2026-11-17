"""The one place that maps an element id prefix to its kind and walks its ownership/container chain.

Replaces the four prefix walkers: `core.auth.owner_user_id`, `core.auth._resolve_containers`,
`utils.resolve_orm_table.resolve_element_model`, and `services.bulk.model_of`. Model classes are
imported lazily (inside `model()`) because the order in `models/__init__.py` is load-bearing.
"""
from dataclasses import dataclass, field
from typing import Optional

from ..core.database import db_manager


@dataclass(frozen=True)
class ElementKind:
    name: str                      # key of ID_PREFIXES, e.g. "Vocabulary"
    prefix: str                    # "voc_"
    parent: Optional[str] = None   # kind name: Vocabulary->"Lesson", Lesson->"Language", Word->"Language"
    parent_attr: Optional[str] = None   # "lesson_id" | "language_id"
    owner_attr: Optional[str] = None    # "user_id" on roots (Language, Tag, Source, UserPreferences)
    bulkable: bool = False         # voc/gram/call/ex
    container: bool = False        # Lesson, Language
    radical_variant: bool = False  # slot for the target domain, unread today
    skills: tuple = field(default=())  # score skills of this kind (stand-in matrix, TODO(owner): spec 2). Empty = aggregate/no own skill, stored as "recall"

    def model(self):
        # lazy import so the registry never triggers a bad import order in models/__init__.py
        from ..models.components import Character, Passage, Word
        from ..models.containers import Language, Lesson
        from ..models.data_collection import ProgressTracking
        from ..models.features import Calligraphy, Exercise, Grammar, Vocabulary
        from ..models.system_data import Source, Tag, User, UserPreferences
        return {
            "Language": Language, "Lesson": Lesson,
            "Vocabulary": Vocabulary, "Grammar": Grammar, "Calligraphy": Calligraphy, "Exercise": Exercise,
            "Character": Character, "Word": Word, "Passage": Passage,
            "Tag": Tag, "Source": Source, "User": User, "UserPreferences": UserPreferences,
            "ProgressTracking": ProgressTracking,
        }[self.name]


_KINDS = {
    "lang_": ElementKind("Language", "lang_", owner_attr="user_id", container=True),
    "lesson_": ElementKind("Lesson", "lesson_", parent="Language", parent_attr="language_id", container=True),
    "voc_": ElementKind("Vocabulary", "voc_", parent="Lesson", parent_attr="lesson_id", bulkable=True, skills=("recognition", "recall")),
    "gram_": ElementKind("Grammar", "gram_", parent="Lesson", parent_attr="lesson_id", bulkable=True, skills=("recognition",)),
    "call_": ElementKind("Calligraphy", "call_", parent="Lesson", parent_attr="lesson_id", bulkable=True, skills=("recall",)),
    "ex_": ElementKind("Exercise", "ex_", parent="Lesson", parent_attr="lesson_id", bulkable=True),
    "char_": ElementKind("Character", "char_", parent="Language", parent_attr="language_id", radical_variant=True, skills=("recall",)),
    "word_": ElementKind("Word", "word_", parent="Language", parent_attr="language_id"),
    "pass_": ElementKind("Passage", "pass_", parent="Language", parent_attr="language_id"),
    "tag_": ElementKind("Tag", "tag_", owner_attr="user_id"),
    "src_": ElementKind("Source", "src_", owner_attr="user_id"),
    "user_": ElementKind("User", "user_"),
    "pref_": ElementKind("UserPreferences", "pref_", owner_attr="user_id"),
    "pt_": ElementKind("ProgressTracking", "pt_"),
}

_KINDS_BY_NAME = {k.name: k for k in _KINDS.values()}

# ID_PREFIXES keys that are system tables, not elements in the language→lesson→element hierarchy.
NON_ELEMENT = {
    "UserSession", "DailyStats", "CommitmentLog", "Collaboration", "Score",
    "LessonShare", "IngestionJob", "ExerciseUserPref", "OverrideFlag", "StudyGoal", "StudyGoalItem", "LessonGate", "CourseSetting", "LearnerDay", "WeeklySnapshot",
}


def kind_of(element_id: str) -> Optional[ElementKind]:
    """The kind for an element id by its prefix; None for unknown/empty."""
    if not isinstance(element_id, str) or not element_id:
        return None
    for prefix, kind in _KINDS.items():
        if element_id.startswith(prefix):
            return kind
    return None


def _find(kind: ElementKind, element_id: str):
    return db_manager.find_by_attr(kind.model(), {"id": element_id})


def owner_of(element_id: str) -> Optional[str]:
    """The owning user id for any element, walking the parent chain; None if not found."""
    kind = kind_of(element_id)
    if kind is None:
        return None
    if kind.owner_attr is not None:
        row = _find(kind, element_id)
        return getattr(row, kind.owner_attr) if row else None
    if kind.parent is not None:
        row = _find(kind, element_id)
        if row is None:
            return None
        return owner_of(getattr(row, kind.parent_attr))
    return None


def containers_of(element_id: str) -> tuple[Optional[str], Optional[str]]:
    """(language_id, lesson_id) for a shareable element; (None, None) otherwise."""
    kind = kind_of(element_id)
    if kind is None:
        return None, None
    if kind.name == "Language":
        return element_id, None
    row = _find(kind, element_id)
    if row is None:
        return None, None
    if kind.name == "Lesson":
        return row.language_id, element_id
    if kind.parent == "Lesson":
        lesson_id = getattr(row, kind.parent_attr)
        lesson = _find(_KINDS_BY_NAME["Lesson"], lesson_id)
        return (lesson.language_id, lesson_id) if lesson else (None, None)
    if kind.parent == "Language":
        return (getattr(row, kind.parent_attr), None)
    return None, None  # roots with no parent (Tag, Source, User, pref, pt)
