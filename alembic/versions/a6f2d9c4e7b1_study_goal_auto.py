"""study_goal.auto: quantities follow the daily minutes

Revision ID: a6f2d9c4e7b1
Revises: f4d0b7a2c5e9
Create Date: 2026-11-05
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a6f2d9c4e7b1'
down_revision: Union[str, Sequence[str], None] = 'f4d0b7a2c5e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('study_goal', sa.Column('auto', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column('study_goal', 'auto')
