"""vocabulary front/back scores: seed a #front and #back Score row from every voc_ row

Revision ID: c1a7e4d9b2f6
Revises: b5e2c8f1a7d3
Create Date: 2026-11-05
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c1a7e4d9b2f6'
down_revision: Union[str, Sequence[str], None] = 'b5e2c8f1a7d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SIDES = ("front", "back")


def _reserve_ids(conn, n: int) -> int:
    """Reserve n Score ids from the id_counter (seeded from the highest existing sc_S<n>); returns the first number."""
    if conn.execute(sa.text("SELECT 1 FROM id_counter WHERE entity_type = 'Score'")).first() is None:
        nums = []
        for (i,) in conn.execute(sa.text("SELECT id FROM score")):
            try:
                nums.append(int(i.split("_")[-1][1:]))
            except (ValueError, IndexError):
                continue
        conn.execute(sa.text("INSERT INTO id_counter (entity_type, next_value) VALUES ('Score', :v)"), {"v": max(nums, default=0) + 1})
    end = conn.execute(sa.text("UPDATE id_counter SET next_value = next_value + :n WHERE entity_type = 'Score' RETURNING next_value"), {"n": n}).scalar_one()
    return end - n


def seed_vocabulary_sides(conn) -> None:
    """Copy each voc_ row onto its #front / #back rows (skipping sides that already exist)."""
    rows = conn.execute(sa.text(
        "SELECT user_id, element_id, score, difficulty, created_at, last_seen_at FROM score "
        "WHERE element_id LIKE 'voc\\_%' AND element_id NOT LIKE '%#%'")).fetchall()
    existing = {r[0] for r in conn.execute(sa.text("SELECT user_id || '|' || element_id FROM score WHERE element_id LIKE '%#%'"))}
    todo = [(r, s) for r in rows for s in SIDES if f"{r.user_id}|{r.element_id}#{s}" not in existing]
    if not todo:
        return
    first = _reserve_ids(conn, len(todo))
    for k, (r, s) in enumerate(todo):
        conn.execute(sa.text(
            "INSERT INTO score (id, user_id, element_id, score, difficulty, created_at, last_seen_at) "
            "VALUES (:id, :u, :e, :s, :d, :c, :l)"),
            {"id": f"sc_S{first + k}", "u": r.user_id, "e": f"{r.element_id}#{s}", "s": r.score,
             "d": r.difficulty, "c": r.created_at, "l": r.last_seen_at})


def upgrade() -> None:
    seed_vocabulary_sides(op.get_bind())


def downgrade() -> None:
    op.execute("DELETE FROM score WHERE element_id LIKE 'voc\\_%#%'")
