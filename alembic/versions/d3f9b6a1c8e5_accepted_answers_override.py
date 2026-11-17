"""`exercise.accepted_answers` (extra answers that count as right) and the `override_flag` table ("I was right", once per attempt)

Additive and idempotent. Existing exercises keep `accepted_answers` empty: their `answer` is the only accepted answer, as before.

Revision ID: d3f9b6a1c8e5
Revises: c8e2a5d7f1b4
Create Date: 2026-11-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'd3f9b6a1c8e5'
down_revision: Union[str, Sequence[str], None] = 'c8e2a5d7f1b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "accepted_answers" not in {c["name"] for c in insp.get_columns("exercise")}:
        op.add_column("exercise", sa.Column("accepted_answers", sa.JSON(), nullable=True))
    if "override_flag" not in insp.get_table_names():
        op.create_table(
            "override_flag",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("user_id", sa.String(), sa.ForeignKey("user.id"), nullable=False),
            sa.Column("exercise_id", sa.String(), nullable=False),
            sa.Column("attempt_id", sa.String(), nullable=False),
            sa.UniqueConstraint("user_id", "exercise_id", "attempt_id", name="uq_override_flag"),
        )
        op.create_index("ix_override_flag_id", "override_flag", ["id"])


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "override_flag" in insp.get_table_names():
        op.drop_table("override_flag")
    if "accepted_answers" in {c["name"] for c in insp.get_columns("exercise")}:
        op.drop_column("exercise", "accepted_answers")
