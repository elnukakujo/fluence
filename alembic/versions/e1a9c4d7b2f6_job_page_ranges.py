"""ingestion_job.page_ranges replaces page_from / page_to

Revision ID: e1a9c4d7b2f6
Revises: 379fd92c2779
Create Date: 2026-11-02
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e1a9c4d7b2f6'
down_revision: Union[str, Sequence[str], None] = '379fd92c2779'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('ingestion_job', sa.Column('page_ranges', sa.JSON(), nullable=True))
    op.execute("UPDATE ingestion_job SET page_ranges = json_build_array(json_build_array(page_from, page_to)) "
               "WHERE page_from IS NOT NULL AND page_to IS NOT NULL")
    op.drop_column('ingestion_job', 'page_to')
    op.drop_column('ingestion_job', 'page_from')


def downgrade() -> None:
    op.add_column('ingestion_job', sa.Column('page_from', sa.Integer(), nullable=True))
    op.add_column('ingestion_job', sa.Column('page_to', sa.Integer(), nullable=True))
    # keeps the first range only (the old columns hold one)
    op.execute("UPDATE ingestion_job SET page_from = (page_ranges->0->>0)::int, page_to = (page_ranges->0->>1)::int "
               "WHERE page_ranges IS NOT NULL")
    op.drop_column('ingestion_job', 'page_ranges')
