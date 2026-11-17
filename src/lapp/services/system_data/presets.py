"""Learning-intensity presets (DM-66): pace only, skills are never part of a preset. The numbers live in shared/presets.json
(the client reads the same file to show them)."""
import json
from pathlib import Path

PRESETS: dict[str, dict[str, int]] = json.loads((Path(__file__).resolve().parents[4] / "shared" / "presets.json").read_text(encoding="utf-8"))
