"""Schema/to_dict() parity check for Character — the Phase 4 serialization contract.

Today input validation (CharacterDict, Pydantic) and API output (Character.to_dict(),
hand-written) are two independent definitions of the same shape. They can drift
silently. This test pins the current field sets and the KNOWN gaps between them,
so any *new* drift (a field added to one side but not the other) fails loudly
instead of surfacing as a subtle frontend bug.

KNOWN_GAPS documents real, pre-existing asymmetries found while auditing this:
- Character.to_dict() calls `super().to_dict(include_relations=False)`, which
  means tags/sources are NEVER included in Character's output regardless of the
  include_relations argument passed to Character.to_dict() itself. CharacterDict
  declares tags/sources (inherited from BaseElementDict) since it's also used for
  input. This is a latent bug in the cooperative to_dict() MRO chain, not
  something this test should paper over — fix it deliberately, separately from
  this net, since fixing it changes the live API response shape.
- to_dict() also emits `calligraphy`, a relation CharacterDict doesn't model
  (Vocabulary/Grammar-style features aren't part of the Character creation payload).
- `language_id` is accepted on create (CharacterDict) but never appears in
  to_dict()'s output — a character's own API response doesn't say which
  language it belongs to. Also a real gap, also a live-response-shape change
  to make deliberately rather than as a side effect of this test.

Follow-up: once ready to unify, replace Character.to_dict() with
CharacterDict.model_validate(character, from_attributes=True) for responses,
fix the tags/sources gap as part of that change (verify the new shape against
the actual frontend before shipping), and delete this test in favor of just
using the schema directly.
"""
from lapp.schemas.components import CharacterDict
from lapp.models.system_data import User
from lapp.models.containers import Language
from lapp.models.components import Character

KNOWN_GAPS_SCHEMA_ONLY = {"tags", "sources", "language_id", "score", "difficulty", "status", "last_seen_at"}  # in CharacterDict, absent from to_dict() (score/difficulty/status/last_seen_at injected via ScoreService.merge)
KNOWN_GAPS_DICT_ONLY = {"calligraphy"}  # emitted by to_dict(), not modeled in CharacterDict


def _seed(db):
    with db.session_scope() as s:
        db.insert(User(id="user_S1", username="parity"), session=s, commit=False)
        db.insert(Language(id="lang_S1", user_id="user_S1", name="Chinese",
                           target_iso639_2t="zho", source_iso639_2t="eng"),
                  session=s, commit=False)
        db.insert(Character(id="char_S1", character="学", language_id="lang_S1",
                            phonetic="xué", meaning="study", radical="子"),
                  session=s, commit=False)


def test_character_schema_and_to_dict_fields_match_known_shape(db):
    _seed(db)
    with db.session_scope() as s:
        character = db.find_by_attr(model_class=Character, attr_values={"id": "char_S1"}, session=s)
        dict_fields = set(character.to_dict(include_relations=True).keys())

    schema_fields = set(CharacterDict.model_fields.keys())

    missing_from_dict = (schema_fields - dict_fields) - KNOWN_GAPS_SCHEMA_ONLY
    missing_from_schema = (dict_fields - schema_fields) - KNOWN_GAPS_DICT_ONLY

    assert not missing_from_dict, (
        f"CharacterDict has fields to_dict() no longer produces: {missing_from_dict}. "
        "Either to_dict() regressed or this field belongs in KNOWN_GAPS_SCHEMA_ONLY."
    )
    assert not missing_from_schema, (
        f"to_dict() now produces fields CharacterDict doesn't model: {missing_from_schema}. "
        "Add the field to CharacterDict or KNOWN_GAPS_DICT_ONLY."
    )


if __name__ == "__main__":
    print("run via: uv run pytest tests/test_serialization_parity.py")
