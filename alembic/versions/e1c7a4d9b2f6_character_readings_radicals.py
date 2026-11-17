"""characters: readings, key radical, components; read-only radical catalogue

Additive and idempotent. Every character's `phonetic` becomes one primary reading of kind "phonetic" (the old
column stays, still filled). `radical` (free text) is untouched.

Revision ID: e1c7a4d9b2f6
Revises: d9a3f6b2c8e1
Create Date: 2026-11-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e1c7a4d9b2f6'
down_revision: Union[str, Sequence[str], None] = 'd9a3f6b2c8e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def backfill_readings(conn) -> None:
    """Only rows still holding the default: re-running never overwrites a reading the learner edited."""
    conn.execute(sa.text(
        "UPDATE character SET readings = json_build_array(json_build_object('kind', 'phonetic', 'value', phonetic, 'primary', true)) "
        "WHERE phonetic IS NOT NULL AND phonetic <> '' AND readings::text = '[]'"))


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("character")}
    if "readings" not in cols:
        op.add_column("character", sa.Column("readings", sa.JSON(), nullable=False, server_default=sa.text("'[]'")))
    if "key_radical_id" not in cols:
        op.add_column("character", sa.Column("key_radical_id", sa.String(), nullable=True))
    if "components" not in cols:
        op.add_column("character", sa.Column("components", sa.JSON(), nullable=False, server_default=sa.text("'[]'")))
    backfill_readings(conn)
    if not insp.has_table("radical_catalogue"):
        op.create_table(
            "radical_catalogue",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("language_iso", sa.String(), nullable=False, index=True),
            sa.Column("character", sa.String(), nullable=False),
            sa.Column("phonetic", sa.String(), nullable=True),
            sa.Column("meaning", sa.String(), nullable=True),
            sa.Column("strokes", sa.Integer(), nullable=True),
            sa.UniqueConstraint("language_iso", "character", name="uq_radical_catalogue_language_character"),
        )


def downgrade() -> None:
    op.drop_table("radical_catalogue")
    for c in ("components", "key_radical_id", "readings"):
        op.drop_column("character", c)
