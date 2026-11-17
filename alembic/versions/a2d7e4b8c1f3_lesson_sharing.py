"""Lesson-level sharing: `lesson_share.owner_id` (backfilled from the lesson) and the `change_log` table

Additive and idempotent. Existing language-level collaborations are left as they are (see RD-110).

Revision ID: a2d7e4b8c1f3
Revises: f1b6d8a2c4e9
Create Date: 2026-11-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a2d7e4b8c1f3'
down_revision: Union[str, Sequence[str], None] = 'f1b6d8a2c4e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "owner_id" not in {c["name"] for c in insp.get_columns("lesson_share")}:
        op.add_column("lesson_share", sa.Column("owner_id", sa.String(), sa.ForeignKey("user.id"), nullable=True))
    bind.execute(sa.text("UPDATE lesson_share SET owner_id = (SELECT user_id FROM lesson WHERE lesson.id = lesson_share.lesson_id) WHERE owner_id IS NULL"))
    if "change_log" not in insp.get_table_names():
        op.create_table(
            "change_log",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("lesson_id", sa.String(), sa.ForeignKey("lesson.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.String(), sa.ForeignKey("user.id"), nullable=False),
            sa.Column("element_id", sa.String(), nullable=False),
            sa.Column("op", sa.String(), nullable=False),
            sa.Column("before", sa.JSON(), nullable=True),
            sa.Column("after", sa.JSON(), nullable=True),
            sa.Column("reverted_at", sa.DateTime(), nullable=True),
            sa.Column("at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_change_log_id", "change_log", ["id"])
        op.create_index("ix_change_log_lesson_id", "change_log", ["lesson_id"])


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "change_log" in insp.get_table_names():
        op.drop_table("change_log")
    if "owner_id" in {c["name"] for c in insp.get_columns("lesson_share")}:
        op.drop_column("lesson_share", "owner_id")
