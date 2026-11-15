"""scripts/score_migration_dry_run.py: refuses without a fresh backup, otherwise only reads."""
import importlib.util
import os
import time
from pathlib import Path

_spec = importlib.util.spec_from_file_location("dry", Path(__file__).parent.parent / "scripts/score_migration_dry_run.py")
dry = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(dry)


def test_refuses_without_a_fresh_backup(tmp_path, capsys):
    assert dry.main(["--url", "postgresql://x/y", "--schema", "s", "--backup-dir", str(tmp_path)]) == 2
    assert "Refusing" in capsys.readouterr().err
    old = tmp_path / "backup_fluence_x_1.dump"
    old.write_bytes(b"x")
    os.utime(old, (time.time() - 7200,) * 2)
    assert not dry.fresh_backup(tmp_path)
    new = tmp_path / "backup_fluence_x_2.dump"
    new.write_bytes(b"x")
    assert dry.fresh_backup(tmp_path)
