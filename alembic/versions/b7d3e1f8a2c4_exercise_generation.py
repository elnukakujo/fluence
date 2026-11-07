"""exercise.generation_batch_id and exercise.review_reason (AI exercise generation)

Revision ID: b7d3e1f8a2c4
Revises: a6f2d9c4e7b1
Create Date: 2026-11-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b7d3e1f8a2c4'
down_revision: Union[str, Sequence[str], None] = 'a6f2d9c4e7b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('exercise', sa.Column('generation_batch_id', sa.String(), nullable=True))
    op.add_column('exercise', sa.Column('review_reason', sa.String(), nullable=True))
    op.create_index('ix_exercise_generation_batch_id', 'exercise', ['generation_batch_id'])


def downgrade() -> None:
    op.drop_index('ix_exercise_generation_batch_id', table_name='exercise')
    op.drop_column('exercise', 'review_reason')
    op.drop_column('exercise', 'generation_batch_id')
