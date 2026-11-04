"""tag.position / source.position: explicit order of a user's tags and sources

Revision ID: b5e2c8f1a7d3
Revises: a9d4e7b2c5f1
Create Date: 2026-11-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b5e2c8f1a7d3'
down_revision: Union[str, Sequence[str], None] = 'a9d4e7b2c5f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for table in ('tag', 'source'):
        op.add_column(table, sa.Column('position', sa.Integer(), nullable=False, server_default='0'))
        # keep today's order (creation time) per user
        op.execute(f"UPDATE {table} SET position = r.pos FROM (SELECT id, row_number() OVER "
                   f"(PARTITION BY user_id ORDER BY created_at, id) - 1 AS pos FROM {table}) r WHERE {table}.id = r.id")


def downgrade() -> None:
    for table in ('tag', 'source'):
        op.drop_column(table, 'position')
