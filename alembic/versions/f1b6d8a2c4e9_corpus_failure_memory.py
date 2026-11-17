"""Local Tatoeba corpus tables (`corpus_sentence`, `corpus_link`) and `failure_memory`

Additive and idempotent. The corpus starts empty: `scripts/load_tatoeba.py <folder>` fills it.

Revision ID: f1b6d8a2c4e9
Revises: e5a1c7d3b9f8
Create Date: 2026-11-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f1b6d8a2c4e9'
down_revision: Union[str, Sequence[str], None] = 'e5a1c7d3b9f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "corpus_sentence" not in tables:
        op.create_table("corpus_sentence",
                        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=False),
                        sa.Column("lang", sa.String(), nullable=False),
                        sa.Column("text", sa.Text(), nullable=False))
        op.create_index("ix_corpus_sentence_lang", "corpus_sentence", ["lang"])
    if "corpus_link" not in tables:
        op.create_table("corpus_link",
                        sa.Column("sentence_id", sa.BigInteger(), primary_key=True, autoincrement=False),
                        sa.Column("translation_id", sa.BigInteger(), primary_key=True, autoincrement=False))
        op.create_index("ix_corpus_link_sentence", "corpus_link", ["sentence_id"])
    if "failure_memory" not in tables:
        op.create_table("failure_memory",
                        sa.Column("id", sa.String(), primary_key=True),
                        sa.Column("kind", sa.String(), nullable=False),
                        sa.Column("key", sa.String(), nullable=False),
                        sa.Column("failed_at", sa.DateTime(), nullable=False))
        op.create_index("ix_failure_memory_id", "failure_memory", ["id"])
        op.create_index("ix_failure_memory_key", "failure_memory", ["key"])


def downgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    for t in ("failure_memory", "corpus_link", "corpus_sentence"):
        if t in tables:
            op.drop_table(t)
