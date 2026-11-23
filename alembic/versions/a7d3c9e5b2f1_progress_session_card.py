"""progress_tracking: review session, card and difficulty (ST-9)

`session_id` groups the answers of one review session, `card_id` the rows one card wrote (an exercise writes one per linked element plus its
own), `difficulty_before/after` feed the session's average difficulty change. All nullable: old rows stay as they are.

Revision ID: a7d3c9e5b2f1
Revises: c4e8a2f6b1d9
Create Date: 2026-11-22
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a7d3c9e5b2f1'
down_revision: Union[str, Sequence[str], None] = 'c4e8a2f6b1d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('progress_tracking', sa.Column('session_id', sa.String(), nullable=True))
    op.add_column('progress_tracking', sa.Column('card_id', sa.String(), nullable=True))
    op.add_column('progress_tracking', sa.Column('difficulty_before', sa.Float(), nullable=True))
    op.add_column('progress_tracking', sa.Column('difficulty_after', sa.Float(), nullable=True))
    op.create_index('ix_progress_tracking_session_id', 'progress_tracking', ['session_id'])


def downgrade() -> None:
    op.drop_index('ix_progress_tracking_session_id', table_name='progress_tracking')
    for column in ('difficulty_after', 'difficulty_before', 'card_id', 'session_id'):
        op.drop_column('progress_tracking', column)
