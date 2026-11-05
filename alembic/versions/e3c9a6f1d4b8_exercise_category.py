"""exercise.category: optional exam-section slug

Revision ID: e3c9a6f1d4b8
Revises: d2b8f5e0c3a7
Create Date: 2026-11-05
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e3c9a6f1d4b8'
down_revision: Union[str, Sequence[str], None] = 'd2b8f5e0c3a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('exercise', sa.Column('category', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('exercise', 'category')
