"""score: a new row starts at stability 5 days (SC-1, RD-128)

Only the column default changes. Existing rows keep their stability: it already grew from the answers they got.

Revision ID: b5e1c9d3a7f2
Revises: a7d3c9e5b2f1
Create Date: 2026-11-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b5e1c9d3a7f2'
down_revision: Union[str, Sequence[str], None] = 'a7d3c9e5b2f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('score', 'stability', existing_type=sa.Float(), server_default=sa.text("5.0"), existing_nullable=False)


def downgrade() -> None:
    op.alter_column('score', 'stability', existing_type=sa.Float(), server_default=sa.text("2.0"), existing_nullable=False)
