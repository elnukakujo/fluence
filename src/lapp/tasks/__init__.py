from .backup import register_backup_tasks
from .text_gen import register_text_gen_tasks
from .tts import register_tts_tasks
from .media_cleanup import register_media_cleanup_tasks
from .weekly_snapshots import register_weekly_snapshot_tasks

__all__ = [
    "register_backup_tasks",
    "register_text_gen_tasks",
    "register_tts_tasks",
    "register_media_cleanup_tasks",
    "register_weekly_snapshot_tasks",
]