"""add page range to ingestion_job

Revision ID: b7d2f4a6c1e8
Revises: a3c8e5b1d9f2
Create Date: 2026-10-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b7d2f4a6c1e8'
down_revision: Union[str, Sequence[str], None] = 'a3c8e5b1d9f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('ingestion_job', sa.Column('page_from', sa.Integer(), nullable=True))
    op.add_column('ingestion_job', sa.Column('page_to', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('ingestion_job', 'page_to')
    op.drop_column('ingestion_job', 'page_from')
