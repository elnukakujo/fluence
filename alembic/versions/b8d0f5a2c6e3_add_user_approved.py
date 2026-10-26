"""add user.approved flag (admin-approval for new signups)

Revision ID: b8d0f5a2c6e3
Revises: a7c9e3f1b5d2
Create Date: 2026-10-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8d0f5a2c6e3'
down_revision: Union[str, Sequence[str], None] = 'a7c9e3f1b5d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing users are already trusted -> default approved=true.
    op.add_column('user', sa.Column('approved', sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade() -> None:
    op.drop_column('user', 'approved')
