"""add ingestion_job

Revision ID: a3c8e5b1d9f2
Revises: d1a7c3e9f2b4
Create Date: 2026-10-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3c8e5b1d9f2'
down_revision: Union[str, Sequence[str], None] = 'd1a7c3e9f2b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ingestion_job',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('user.id', ondelete='CASCADE'), nullable=False),
        sa.Column('language_id', sa.String(), sa.ForeignKey('language.id', ondelete='CASCADE'), nullable=False),
        sa.Column('lesson_id', sa.String(), sa.ForeignKey('lesson.id', ondelete='SET NULL'), nullable=True),
        sa.Column('filename', sa.String(), nullable=False),
        sa.Column('file_path', sa.String(), nullable=False),
        sa.Column('handwritten', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('status', sa.String(), nullable=False, server_default='queued'),
        sa.Column('pages_done', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('pages_total', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('warnings', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_ingestion_job_id', 'ingestion_job', ['id'])
    op.create_index('ix_ingestion_job_user_id', 'ingestion_job', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_ingestion_job_user_id', table_name='ingestion_job')
    op.drop_index('ix_ingestion_job_id', table_name='ingestion_job')
    op.drop_table('ingestion_job')
