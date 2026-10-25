"""add auth/admin fields + user_session table; promote demo to admin

Revision ID: a7c9e3f1b5d2
Revises: f88f6fd7f3e9
Create Date: 2026-10-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7c9e3f1b5d2'
down_revision: Union[str, Sequence[str], None] = 'f88f6fd7f3e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('user', sa.Column('is_admin', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('user', sa.Column('blocked', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('user', sa.Column('last_login_at', sa.DateTime(), nullable=True))
    op.add_column('user', sa.Column('failed_login_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('user', sa.Column('locked_until', sa.DateTime(), nullable=True))

    op.create_table(
        'user_session',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('token_hash', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_user_session_id', 'user_session', ['id'])
    op.create_index('ix_user_session_token_hash', 'user_session', ['token_hash'], unique=True)

    # Promote the demo account (first created) to admin.
    op.execute("UPDATE \"user\" SET is_admin = true WHERE email = 'demo@example.com'")


def downgrade() -> None:
    op.drop_table('user_session')
    op.drop_column('user', 'locked_until')
    op.drop_column('user', 'failed_login_count')
    op.drop_column('user', 'last_login_at')
    op.drop_column('user', 'blocked')
    op.drop_column('user', 'is_admin')
