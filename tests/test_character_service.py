"""CharacterService round-trip through the @transactional decorator.

Inserts fixtures directly (bypassing spaCy enrichment) then drives the service's
read / score / delete paths to prove the managed-session plumbing works.
"""
from lapp.core.database import db_manager
from lapp.models.system_data import User
from lapp.models.containers import Language
from lapp.models.components import Character
from lapp.services.components.character import CharacterService

service = CharacterService()


def _seed(db):
    with db.session_scope() as s:
        db.insert(User(id="user_C1", username="ling"), session=s, commit=False)
        db.insert(Language(id="lang_C1", user_id="user_C1", name="Chinese",
                           target_iso639_2t="zho", source_iso639_2t="eng"),
                  session=s, commit=False)
        db.insert(Character(id="char_C1", character="好", language_id="lang_C1", score=40,
                            phonetic="hǎo", meaning="good", radical="女"),
                  session=s, commit=False)


def test_get_by_id_no_session_arg(db):
    _seed(db)
    got = service.get_by_id("char_C1")          # decorator opens + closes its own scope
    assert got is not None and got.character == "好"


def test_update_score_with_no_features_resets(db):
    _seed(db)
    updated = service.update_score("char_C1", user_id="user_C1")   # no calligraphy features → score 0, diff 0.5
    assert updated.score == 0.0 and updated.difficulty == 0.5


def test_delete_roundtrip(db):
    _seed(db)
    assert service.delete("char_C1") is True
    assert service.get_by_id("char_C1") is None
    assert service.delete("char_C1") is False   # already gone


if __name__ == "__main__":
    print("run via: uv run pytest tests/test_character_service.py")
