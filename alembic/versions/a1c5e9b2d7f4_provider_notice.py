"""`user_preferences.provider_notices_seen` (base URLs whose one-time provider disclosure was acknowledged)

Additive and idempotent. Existing users start with an empty list: they see each notice once.

Revision ID: a1c5e9b2d7f4
Revises: d3f9b6a1c8e5
Create Date: 2026-11-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a1c5e9b2d7f4'
down_revision: Union[str, Sequence[str], None] = 'd3f9b6a1c8e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "provider_notices_seen" not in {c["name"] for c in insp.get_columns("user_preferences")}:
        op.add_column("user_preferences", sa.Column("provider_notices_seen", sa.JSON(), nullable=True))


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "provider_notices_seen" in {c["name"] for c in insp.get_columns("user_preferences")}:
        op.drop_column("user_preferences", "provider_notices_seen")
