"""characters: link every free-text radical to a Character; backfill readings

Data only (no schema change), idempotent. For each character whose `radical` text is a single character other than
itself and whose `key_radical_id` is empty: the Character of that glyph in the same language becomes its key radical,
created as a bare row when the language has none (DM-48: radicals are characters). A link that would make a cycle is
skipped. Languages without characters (Korean, DM-50) are left alone. The `radical` text is kept. Readings are
backfilled again for characters that gained a phonetic since e1c7a4d9b2f6. Components cannot be derived from the
existing data, so they stay empty until the learner types them.
Take a backup first.

Revision ID: f2d8b5c1a7e3
Revises: e1c7a4d9b2f6
Create Date: 2026-11-16
"""
import json
from datetime import datetime
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f2d8b5c1a7e3'
down_revision: Union[str, Sequence[str], None] = 'e1c7a4d9b2f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NO_CHARACTER_LANGUAGES = ("kor",)      # frozen copy of services/components/character.py (DM-50)
ID_PREFIX = "char_C"


def _next_ids(conn, n: int) -> int:
    """Reserve n Character ids from id_counter (seeded from the highest existing char_C<n>); returns the first number."""
    if conn.execute(sa.text("SELECT 1 FROM id_counter WHERE entity_type = 'Character'")).first() is None:
        nums = []
        for (i,) in conn.execute(sa.text("SELECT id FROM character")):
            try:
                nums.append(int(i[len(ID_PREFIX):]))
            except ValueError:
                continue
        conn.execute(sa.text("INSERT INTO id_counter (entity_type, next_value) VALUES ('Character', :v)"), {"v": max(nums, default=0) + 1})
    end = conn.execute(sa.text("UPDATE id_counter SET next_value = next_value + :n WHERE entity_type = 'Character' RETURNING next_value"),
                       {"n": n}).scalar_one()
    return end - n


def link_text_radicals(conn) -> dict:
    """Returns {"linked": n, "created": n, "skipped_cycle": n}."""
    skip = tuple(NO_CHARACTER_LANGUAGES)
    rows = conn.execute(sa.text(
        "SELECT c.id, c.language_id, c.character, c.radical, c.key_radical_id, c.components FROM character c "
        "JOIN language l ON l.id = c.language_id WHERE l.target_iso639_2t NOT IN :skip ORDER BY c.id"
    ).bindparams(sa.bindparam("skip", expanding=True)), {"skip": skip}).fetchall()
    chars = {r.id: {"lang": r.language_id, "glyph": r.character, "radical": (r.radical or "").strip(),
                    "key": r.key_radical_id, "comps": list(r.components or [])} for r in rows}
    by_glyph = {(c["lang"], c["glyph"]): i for i, c in chars.items()}

    def reaches(start: str, target: str) -> bool:
        seen, stack = set(), [start]
        while stack:
            cur = stack.pop()
            if cur == target:
                return True
            if cur in seen or cur not in chars:
                continue
            seen.add(cur)
            stack += [*([chars[cur]["key"]] if chars[cur]["key"] else []), *chars[cur]["comps"]]
        return False

    todo = [(i, c) for i, c in chars.items() if not c["key"] and len(c["radical"]) == 1 and c["radical"] != c["glyph"]]
    missing = sorted({(c["lang"], c["radical"]) for _, c in todo if (c["lang"], c["radical"]) not in by_glyph})
    first = _next_ids(conn, len(missing)) if missing else 0
    now = datetime.now()
    for k, (lang, glyph) in enumerate(missing):
        new_id = f"{ID_PREFIX}{first + k}"
        conn.execute(sa.text(
            "INSERT INTO character (id, language_id, character, created_at, image_files, audio_files, readings, components) "
            "VALUES (:id, :l, :c, :now, '[]', '[]', '[]', '[]')"), {"id": new_id, "l": lang, "c": glyph, "now": now})
        chars[new_id] = {"lang": lang, "glyph": glyph, "radical": "", "key": None, "comps": []}
        by_glyph[(lang, glyph)] = new_id

    linked = skipped = 0
    for i, c in todo:
        target = by_glyph[(c["lang"], c["radical"])]
        if reaches(target, i):
            skipped += 1
            continue
        c["key"] = target
        conn.execute(sa.text("UPDATE character SET key_radical_id = :k WHERE id = :id"), {"k": target, "id": i})
        linked += 1
    return {"linked": linked, "created": len(missing), "skipped_cycle": skipped}


def backfill_readings(conn) -> None:
    conn.execute(sa.text(
        "UPDATE character SET readings = json_build_array(json_build_object('kind', 'phonetic', 'value', phonetic, 'primary', true)) "
        "WHERE phonetic IS NOT NULL AND phonetic <> '' AND readings::text = '[]'"))


def upgrade() -> None:
    conn = op.get_bind()
    link_text_radicals(conn)
    backfill_readings(conn)


def downgrade() -> None:
    pass   # data only; the links are ordinary data the learner may have edited since
