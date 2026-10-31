"""add page_kinds to ingestion_job

Revision ID: d4f2b8a6e1c3
Revises: c8e1a7d3f5b9
Create Date: 2026-10-31
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4f2b8a6e1c3'
down_revision: Union[str, Sequence[str], None] = 'c8e1a7d3f5b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('ingestion_job', sa.Column('page_kinds', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('ingestion_job', 'page_kinds')
