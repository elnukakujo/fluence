"""Endpoints set up before the connection-test rule count as tested, so a working import/feedback setup does not switch itself off

Only endpoints that have never carried a `test` record are stamped (passed, for their current configuration). The learner can
still re-run the test. The downgrade does nothing: a stamped test cannot be told from a real one.

Revision ID: c4e8a2f6b1d9
Revises: b3c9e1d5a7f2
Create Date: 2026-11-17
"""
import json
from datetime import datetime
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c4e8a2f6b1d9'
down_revision: Union[str, Sequence[str], None] = 'b3c9e1d5a7f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from lapp.services.capabilities import config_hash
    bind = op.get_bind()
    if "user_preferences" not in sa.inspect(bind).get_table_names():
        return
    now = datetime.now().isoformat(timespec="seconds")
    for pid, raw in bind.execute(sa.text("SELECT id, ai_endpoints FROM user_preferences")).fetchall():
        eps = json.loads(raw) if isinstance(raw, str) else raw
        if not isinstance(eps, list):
            continue
        changed = False
        for e in eps:
            if isinstance(e, dict) and e.get("base_url") and "test" not in e:
                e["test"] = {"passed": True, "at": now, "config_hash": config_hash(e)}
                changed = True
        if changed:
            bind.execute(sa.text("UPDATE user_preferences SET ai_endpoints = :v WHERE id = :i"), {"v": json.dumps(eps), "i": pid})


def downgrade() -> None:
    pass
