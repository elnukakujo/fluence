"""Settings groups 1-4: account columns on `user_preferences` and the `course_setting` table

Additive and idempotent. Existing learners get the documented defaults (pace = Standard, nothing else changes).

Revision ID: d9b3f1a7c5e2
Revises: c4a8d2f6b9e1
Create Date: 2026-11-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'd9b3f1a7c5e2'
down_revision: Union[str, Sequence[str], None] = 'c4a8d2f6b9e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUMNS = [
    ("new_per_week", sa.Integer(), "15", False), ("reviews_per_day", sa.Integer(), "40", False),
    ("interface_language", sa.String(), None, True), ("theme", sa.String(), "system", False),
    ("show_scores", sa.Boolean(), "false", False), ("hints_enabled", sa.Boolean(), "true", False),
    ("retry_wrong", sa.Boolean(), "true", False), ("calligraphy_draw_first", sa.Boolean(), "true", False),
    ("calligraphy_stroke_guide", sa.Boolean(), "true", False), ("audio_autoplay", sa.Boolean(), "false", False),
    ("enabled_skills", sa.JSON(), None, True),
]


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    have = {c["name"] for c in insp.get_columns("user_preferences")}
    for name, type_, default, nullable in COLUMNS:
        if name not in have:
            op.add_column("user_preferences", sa.Column(name, type_, nullable=nullable,
                                                        server_default=default if default is not None else None))
    if "course_setting" not in insp.get_table_names():
        op.create_table(
            "course_setting",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("user_id", sa.String(), sa.ForeignKey("user.id"), nullable=False),
            sa.Column("language_id", sa.String(), sa.ForeignKey("language.id", ondelete="CASCADE"), nullable=False),
            sa.Column("key", sa.String(), nullable=False),
            sa.Column("value", sa.JSON(), nullable=True),
            sa.UniqueConstraint("user_id", "language_id", "key", name="uq_course_setting"),
        )
        op.create_index("ix_course_setting_id", "course_setting", ["id"])


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "course_setting" in insp.get_table_names():
        op.drop_table("course_setting")
    have = {c["name"] for c in insp.get_columns("user_preferences")}
    for name, *_ in reversed(COLUMNS):
        if name in have:
            op.drop_column("user_preferences", name)
