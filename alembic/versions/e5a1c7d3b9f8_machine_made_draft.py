"""`exercise.machine_made` and `exercise.draft` (AI drafts, DM-16/17)

Additive and idempotent. Nothing existing becomes a draft (it was already in study); exercises that came from a generation
run are marked `machine_made`.

Revision ID: e5a1c7d3b9f8
Revises: d9b3f1a7c5e2
Create Date: 2026-11-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e5a1c7d3b9f8'
down_revision: Union[str, Sequence[str], None] = 'd9b3f1a7c5e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    have = {c["name"] for c in sa.inspect(bind).get_columns("exercise")}
    for name in ("machine_made", "draft"):
        if name not in have:
            op.add_column("exercise", sa.Column(name, sa.Boolean(), nullable=False, server_default=sa.text("false")))
    bind.execute(sa.text("UPDATE exercise SET machine_made = true WHERE generation_batch_id IS NOT NULL AND machine_made = false"))


def downgrade() -> None:
    have = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("exercise")}
    for name in ("draft", "machine_made"):
        if name in have:
            op.drop_column("exercise", name)
