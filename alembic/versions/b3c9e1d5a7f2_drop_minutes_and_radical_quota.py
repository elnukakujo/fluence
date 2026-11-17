"""Drop `user_preferences.daily_goal_minutes` (the pace is in answers now) and the radicals quota of the study goals

Idempotent. The downgrade puts the columns back with their defaults (the dropped values are not restored).

Revision ID: b3c9e1d5a7f2
Revises: a2d7e4b8c1f3
Create Date: 2026-11-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b3c9e1d5a7f2'
down_revision: Union[str, Sequence[str], None] = 'a2d7e4b8c1f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DROPPED = (("user_preferences", "daily_goal_minutes", sa.Integer(), "20"),
           ("study_goal", "n_radicals", sa.Integer(), "0"),
           ("study_goal", "r_radicals", sa.Integer(), "0"),
           ("study_goal_item", "radical", sa.Boolean(), "false"))


def _has(insp, table: str, column: str) -> bool:
    return column in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    for table, column, _type, _default in DROPPED:
        if _has(insp, table, column):
            op.drop_column(table, column)


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    for table, column, type_, default in DROPPED:
        if not _has(insp, table, column):
            op.add_column(table, sa.Column(column, type_, nullable=False, server_default=default))
