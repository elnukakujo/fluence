"""add collaboration offer columns and lesson_share lesson cascade

Revision ID: d1a7c3e9f2b4
Revises: b5e2f1c9d8a7
Create Date: 2026-10-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd1a7c3e9f2b4'
down_revision: Union[str, Sequence[str], None] = 'b5e2f1c9d8a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FK = 'lesson_share_lesson_id_fkey'


def upgrade() -> None:
    op.add_column('collaboration', sa.Column('proposed_mode', sa.String(), nullable=True))
    op.add_column('collaboration', sa.Column('offered_lesson_ids', sa.JSON(), nullable=True))
    op.drop_constraint(FK, 'lesson_share', type_='foreignkey')
    op.create_foreign_key(FK, 'lesson_share', 'lesson', ['lesson_id'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    op.drop_constraint(FK, 'lesson_share', type_='foreignkey')
    op.create_foreign_key(FK, 'lesson_share', 'lesson', ['lesson_id'], ['id'])
    op.drop_column('collaboration', 'offered_lesson_ids')
    op.drop_column('collaboration', 'proposed_mode')
