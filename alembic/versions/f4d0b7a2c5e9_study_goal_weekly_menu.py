"""study goal: review quantities, locked period menu, item kind

Revision ID: f4d0b7a2c5e9
Revises: e3c9a6f1d4b8
Create Date: 2026-11-05
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f4d0b7a2c5e9'
down_revision: Union[str, Sequence[str], None] = 'e3c9a6f1d4b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for col in ('r_vocabulary', 'r_grammar', 'r_calligraphy'):
        op.add_column('study_goal', sa.Column(col, sa.Integer(), nullable=False, server_default='0'))
    op.add_column('study_goal', sa.Column('locked', sa.JSON(), nullable=True))
    op.add_column('study_goal_item', sa.Column('kind', sa.String(), nullable=False, server_default='new'))


def downgrade() -> None:
    op.drop_column('study_goal_item', 'kind')
    op.drop_column('study_goal', 'locked')
    for col in ('r_grammar', 'r_calligraphy', 'r_vocabulary'):
        op.drop_column('study_goal', col)
