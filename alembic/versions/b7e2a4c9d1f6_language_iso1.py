"""`language.iso1`: the supported-language code of a course, backfilled from `target_iso639_2t`, then name/alias

Additive and idempotent. Nothing is deleted or merged: courses that match no supported language, and second
courses of the same language for one user, keep `iso1` NULL and are listed by `scripts/language_migration_report.py`.
The NOT NULL + unique revision is a later one, run only after the owner has reviewed that report.

Revision ID: b7e2a4c9d1f6
Revises: a1c5e9b2d7f4
Create Date: 2026-11-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b7e2a4c9d1f6'
down_revision: Union[str, Sequence[str], None] = 'a1c5e9b2d7f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from lapp.core.languages import assign_iso1
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "iso1" not in {c["name"] for c in insp.get_columns("language")}:
        op.add_column("language", sa.Column("iso1", sa.String(), nullable=True))
        op.create_index("ix_language_iso1", "language", ["iso1"])
    # courses already holding an iso1 are kept; the rest are matched in display order
    rows = bind.execute(sa.text(
        'SELECT id, user_id, name, alias, target_iso639_2t FROM language WHERE iso1 IS NULL ORDER BY user_id, position, id'
    )).fetchall()
    for id_, iso1 in assign_iso1(rows).items():
        bind.execute(sa.text('UPDATE language SET iso1 = :iso1 WHERE id = :id'), {"iso1": iso1, "id": id_})


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "iso1" in {c["name"] for c in insp.get_columns("language")}:
        op.drop_index("ix_language_iso1", table_name="language")
        op.drop_column("language", "iso1")
