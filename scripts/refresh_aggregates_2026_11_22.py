"""One-off prod repair, last step (spec 2026-11-22): after the score repair, rewrite the stored lesson and language scores from their children
(they are only written when a card is answered, so they would keep their old low values until then). `touch=False`: no row counts as reviewed.

    DATABASE_URL=postgresql://u:p@host:port/db python scripts/refresh_aggregates_2026_11_22.py --user user_U0 --env prod
"""
import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

if __name__ == "__main__":
    a = argparse.ArgumentParser()
    a.add_argument("--user", required=True); a.add_argument("--env", default="prod")
    args = a.parse_args()
    from lapp.api.app import create_app
    from lapp.core.database import db_manager
    from lapp.models.containers import Language, Lesson
    from lapp.services.containers import LanguageService, LessonService
    app = create_app(args.env)
    with app.app_context():
        with db_manager.session_scope() as s:
            languages = [(l.id, [x.id for x in s.query(Lesson).filter_by(language_id=l.id)]) for l in s.query(Language).filter_by(user_id=args.user)]
        for language_id, lessons in languages:
            for lesson_id in lessons:
                LessonService().update_score(lesson_id, user_id=args.user, touch=False)
            LanguageService().update_score(language_id, user_id=args.user, touch=False)
            print(f"{language_id}: {len(lessons)} lessons refreshed")
