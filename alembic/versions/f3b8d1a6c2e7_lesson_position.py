"""lesson.position: explicit order within a language

Revision ID: f3b8d1a6c2e7
Revises: e1a9c4d7b2f6
Create Date: 2026-11-02
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f3b8d1a6c2e7'
down_revision: Union[str, Sequence[str], None] = 'e1a9c4d7b2f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('lesson', sa.Column('position', sa.Integer(), nullable=False, server_default='0'))
    # keep today's order (creation time) per language
    op.execute("UPDATE lesson SET position = r.pos FROM (SELECT id, row_number() OVER "
               "(PARTITION BY language_id ORDER BY created_at, id) - 1 AS pos FROM lesson) r WHERE lesson.id = r.id")


def downgrade() -> None:
    op.drop_column('lesson', 'position')
