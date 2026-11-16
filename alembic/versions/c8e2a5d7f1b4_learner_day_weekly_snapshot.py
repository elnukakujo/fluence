"""new tables `learner_day` (streak per learner and day) and `weekly_snapshot` (level counts when a week closed)

Additive and idempotent (a table already present is skipped). Existing days are not back-filled: the streak and the trends
start from the first answer after this migration. Take a backup first.

Revision ID: c8e2a5d7f1b4
Revises: b6d1f8a3c5e7
Create Date: 2026-11-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c8e2a5d7f1b4'
down_revision: Union[str, Sequence[str], None] = 'b6d1f8a3c5e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    have = sa.inspect(op.get_bind()).get_table_names()
    if "learner_day" not in have:
        op.create_table(
            "learner_day",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("user_id", sa.String(), sa.ForeignKey("user.id"), nullable=False),
            sa.Column("day", sa.Date(), nullable=False),
            sa.Column("answers", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("validated", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("streak_length", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("user_id", "day", name="uq_learner_day_user_day"),
        )
        op.create_index("ix_learner_day_id", "learner_day", ["id"])
    if "weekly_snapshot" not in have:
        op.create_table(
            "weekly_snapshot",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("user_id", sa.String(), sa.ForeignKey("user.id"), nullable=False),
            sa.Column("language_id", sa.String(), sa.ForeignKey("language.id", ondelete="CASCADE"), nullable=False),
            sa.Column("week_start", sa.Date(), nullable=False),
            *[sa.Column(n, sa.Integer(), nullable=False, server_default="0")
              for n in ("n_learning", "n_known", "n_mastered", "n_fading", "n_seen", "n_total")],
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("user_id", "language_id", "week_start", name="uq_weekly_snapshot_week"),
        )
        op.create_index("ix_weekly_snapshot_id", "weekly_snapshot", ["id"])


def downgrade() -> None:
    have = sa.inspect(op.get_bind()).get_table_names()
    for table in ("weekly_snapshot", "learner_day"):
        if table in have:
            op.drop_table(table)
