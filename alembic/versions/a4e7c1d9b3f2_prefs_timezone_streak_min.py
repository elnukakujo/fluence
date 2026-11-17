"""user_preferences: learner time zone and the answers that validate a streak day

Additive and idempotent (skips a column that exists). Take a backup first.

Revision ID: a4e7c1d9b3f2
Revises: f2d8b5c1a7e3
Create Date: 2026-11-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a4e7c1d9b3f2'
down_revision: Union[str, Sequence[str], None] = 'f2d8b5c1a7e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columns() -> set[str]:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns("user_preferences")}


def upgrade() -> None:
    have = _columns()
    if "timezone" not in have:
        op.add_column("user_preferences", sa.Column("timezone", sa.String(), nullable=True))
    if "streak_min_answers" not in have:
        op.add_column("user_preferences", sa.Column("streak_min_answers", sa.Integer(), nullable=False, server_default="20"))


def downgrade() -> None:
    have = _columns()
    if "streak_min_answers" in have:
        op.drop_column("user_preferences", "streak_min_answers")
    if "timezone" in have:
        op.drop_column("user_preferences", "timezone")
