"""DM-46 / SG-14: the one lookup of which types a language studies."""
from lapp.models.containers import Language
from lapp.services.features.studied_types import studied_types, is_studied
from lapp.services.system_data.settings import ELEMENT_TYPES  # noqa: F401  (the stored spelling)
from test_exercise_credit import U, _seed
from lapp.models.system_data import CourseSetting


def _set(db, language_id, value):
    with db.session_scope() as s:
        db.insert(CourseSetting(id=db.generate_new_id(model_class=CourseSetting, session=s), user_id=U, language_id=language_id,
                                key="element_types", value=value), session=s, commit=False)


def test_default_is_every_type(app, db):
    _seed(db)
    assert studied_types(U, "lang_L1") == ["vocabulary", "grammar", "calligraphy", "exercise"]


def test_a_course_choice_maps_exercises_and_keeps_the_canonical_order(app, db):
    _seed(db)
    _set(db, "lang_L1", ["exercises", "vocabulary"])
    assert studied_types(U, "lang_L1") == ["vocabulary", "exercise"]
    assert is_studied("calligraphy", U, "lang_L1") is False and is_studied("exercise", U, "lang_L1") is True


def test_another_language_is_unaffected(app, db):
    _seed(db)
    with db.session_scope() as s:
        db.insert(Language(id="lang_L2", user_id=U, name="German", target_iso639_2t="deu", source_iso639_2t="eng"), session=s, commit=False)
    _set(db, "lang_L2", ["vocabulary"])
    assert studied_types(U, "lang_L1") == ["vocabulary", "grammar", "calligraphy", "exercise"]
    assert studied_types(U, "lang_L2") == ["vocabulary"]
