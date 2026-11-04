"""language.position: explicit order of a user's languages

Revision ID: a9d4e7b2c5f1
Revises: f3b8d1a6c2e7
Create Date: 2026-11-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a9d4e7b2c5f1'
down_revision: Union[str, Sequence[str], None] = 'f3b8d1a6c2e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('language', sa.Column('position', sa.Integer(), nullable=False, server_default='0'))
    # keep today's order (creation time) per user
    op.execute("UPDATE language SET position = r.pos FROM (SELECT id, row_number() OVER "
               "(PARTITION BY user_id ORDER BY created_at, id) - 1 AS pos FROM language) r WHERE language.id = r.id")


def downgrade() -> None:
    op.drop_column('language', 'position')
