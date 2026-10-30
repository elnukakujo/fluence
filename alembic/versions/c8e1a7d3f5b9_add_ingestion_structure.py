"""add structure to ingestion_job

Revision ID: c8e1a7d3f5b9
Revises: b7d2f4a6c1e8
Create Date: 2026-10-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c8e1a7d3f5b9'
down_revision: Union[str, Sequence[str], None] = 'b7d2f4a6c1e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('ingestion_job', sa.Column('structure', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('ingestion_job', 'structure')
