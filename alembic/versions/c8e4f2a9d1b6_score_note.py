"""score.note: the user's own mnemonic for an element

Revision ID: c8e4f2a9d1b6
Revises: b7d3e1f8a2c4
Create Date: 2026-11-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c8e4f2a9d1b6'
down_revision: Union[str, Sequence[str], None] = 'b7d3e1f8a2c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('score', sa.Column('note', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('score', 'note')
