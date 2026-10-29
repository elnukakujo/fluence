"""add collaboration mode and lesson_share

Revision ID: b5e2f1c9d8a7
Revises: c9d4e1f8a2b3
Create Date: 2026-10-29
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b5e2f1c9d8a7'
down_revision: Union[str, Sequence[str], None] = 'c9d4e1f8a2b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('collaboration', sa.Column('mode', sa.String(), nullable=True))
    op.create_table('lesson_share',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('lesson_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['lesson_id'], ['lesson.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('lesson_id', 'user_id', name='uq_lesson_share_lesson_user'),
    )
    op.create_index(op.f('ix_lesson_share_id'), 'lesson_share', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_lesson_share_id'), table_name='lesson_share')
    op.drop_table('lesson_share')
    op.drop_column('collaboration', 'mode')
