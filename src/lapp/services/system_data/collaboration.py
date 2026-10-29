from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from ...core.database import db_manager, transactional
from ...models.system_data import Collaboration


class CollaborationService:
    @transactional
    def invite(self, master_id: str, collaborator_id: str, target_type: str, target_id: str,
               session: Optional[Session] = None) -> Collaboration:
        """Invite a collaborator (idempotent)."""
        existing = session.query(Collaboration).filter(
            Collaboration.master_id == master_id,
            Collaboration.collaborator_id == collaborator_id,
            Collaboration.target_type == target_type,
            Collaboration.target_id == target_id,
        ).first()
        if existing:
            return existing
        collab = Collaboration(
            id=db_manager.generate_new_id(Collaboration, session=session),
            master_id=master_id,
            collaborator_id=collaborator_id,
            target_type=target_type,
            target_id=target_id,
            status="pending",
        )
        session.add(collab)
        session.flush()
        return collab

    @transactional
    def accept(self, collaboration_id: str, mode: Optional[str] = None,
               lesson_ids: Optional[list[str]] = None,
               session: Optional[Session] = None) -> Optional[Collaboration]:
        collab = session.query(Collaboration).filter(Collaboration.id == collaboration_id).first()
        if not collab:
            return collab
        collab.mode = mode
        if mode == "partial":
            self.share_master_lessons(collab.master_id, collab.collaborator_id, collab.target_id,
                                      lesson_ids=lesson_ids, session=session)
            collab.status = "accepted"
        elif mode == "full" and self._has_collision(collab.collaborator_id, collab.target_id, session):
            collab.status = "awaiting_master_consent"
        else:
            collab.status = "accepted"
        session.flush()
        return collab

    def _has_collision(self, collaborator_id: str, target_id: str, session: Session) -> bool:
        """True if the collaborator owns a language with the same source+target ISO couple."""
        from ...models.containers import Language
        target = session.query(Language).filter(Language.id == target_id).first()
        if not target:
            return False
        return session.query(Language).filter(
            Language.user_id == collaborator_id,
            Language.target_iso639_2t == target.target_iso639_2t,
            Language.source_iso639_2t == target.source_iso639_2t,
        ).first() is not None

    @transactional
    def consent(self, collaboration_id: str, session: Optional[Session] = None) -> Optional[Collaboration]:
        """Master approves a full merge: merge the collaborator's same-ISO language into the target."""
        from ...models.containers import Language
        collab = session.query(Collaboration).filter(Collaboration.id == collaboration_id).first()
        if not collab or collab.mode != "full" or collab.status != "awaiting_master_consent":
            return collab
        target = session.query(Language).filter(Language.id == collab.target_id).first()
        if target:
            collab_lang = session.query(Language).filter(
                Language.user_id == collab.collaborator_id,
                Language.target_iso639_2t == target.target_iso639_2t,
                Language.source_iso639_2t == target.source_iso639_2t,
            ).first()
            if collab_lang:
                self.merge_language(collab_lang.id, collab.target_id, collab.collaborator_id, session=session)
        collab.status = "accepted"
        session.flush()
        return collab

    @transactional
    def share_master_lessons(self, master_id: str, collaborator_id: str, language_id: str,
                             lesson_ids: Optional[list[str]] = None,
                             session: Optional[Session] = None) -> None:
        from ...models.containers import Lesson
        from .lesson_share import LessonShareService
        q = session.query(Lesson).filter(Lesson.language_id == language_id)
        if lesson_ids is not None:
            q = q.filter(Lesson.id.in_(lesson_ids))
        for lesson in q.all():
            LessonShareService().share(lesson.id, collaborator_id, session=session)

    @transactional
    def list_awaiting_consent(self, master_id: str, session: Optional[Session] = None) -> list[dict]:
        collabs = session.query(Collaboration).filter(
            Collaboration.master_id == master_id,
            Collaboration.status == "awaiting_master_consent",
        ).all()
        return [{"id": c.id, "collaborator_id": c.collaborator_id, "target_id": c.target_id,
                 "target_type": c.target_type, "mode": c.mode} for c in collabs]

    @transactional
    def reject(self, collaboration_id: str, session: Optional[Session] = None) -> bool:
        collab = session.query(Collaboration).filter(Collaboration.id == collaboration_id).first()
        if not collab:
            return False
        session.delete(collab)
        return True

    @transactional
    def remove(self, collaboration_id: str, session: Optional[Session] = None) -> bool:
        """Remove the collaboration link. Full mode forks content back to the collaborator;
        partial mode merely drops the lesson_share pointers."""
        collab = session.query(Collaboration).filter(Collaboration.id == collaboration_id).first()
        if not collab:
            return False
        if collab.mode == "partial":
            self._unshare(collab, session)
        else:
            self._fork(collab.collaborator_id, collab.target_type, collab.target_id, session)
        session.delete(collab)
        return True

    def _unshare(self, collab: Collaboration, session: Session) -> None:
        """Drop every lesson_share pointer for the collaborator on the target's lessons."""
        from ...models.containers import Lesson
        from ...models.system_data import LessonShare
        lesson_ids = [l.id for l in session.query(Lesson).filter(
            Lesson.language_id == collab.target_id).all()]
        if lesson_ids:
            session.query(LessonShare).filter(
                LessonShare.user_id == collab.collaborator_id,
                LessonShare.lesson_id.in_(lesson_ids),
            ).delete(synchronize_session=False)

    @transactional
    def leave_lesson(self, lesson_id: str, user_id: str, session: Optional[Session] = None) -> None:
        """Unshare one lesson; if the user holds no remaining shares on its language, end the
        language collaboration so the master can invite them again."""
        from ...models.containers import Lesson
        from ...models.system_data import LessonShare
        from .lesson_share import LessonShareService
        LessonShareService().unshare(lesson_id, user_id, session=session)
        lesson = session.query(Lesson).filter(Lesson.id == lesson_id).first()
        if lesson is None:
            return
        remaining = session.query(LessonShare).join(
            Lesson, LessonShare.lesson_id == Lesson.id).filter(
            LessonShare.user_id == user_id,
            Lesson.language_id == lesson.language_id,
        ).first()
        if remaining is not None:
            return
        for collab in session.query(Collaboration).filter(
            Collaboration.collaborator_id == user_id,
            Collaboration.target_type == "language",
            Collaboration.target_id == lesson.language_id,
            Collaboration.status == "accepted",
        ).all():
            session.delete(collab)

    def _fork(self, collaborator_id: str, target_type: str, target_id: str, session: Session) -> None:
        """Deep-copy the shared container + descendants into the collaborator's account, mapping progress."""
        from ...models.containers import Language, Lesson
        from ...models.components import Word, Character, Passage
        from ...models.features import Vocabulary, Grammar, Calligraphy, Exercise
        from ...models.system_data import Score

        def clone(model, **fields):
            obj = model(id=db_manager.generate_new_id(model, session=session), **fields)
            session.add(obj)
            return obj

        # component/feature id maps (old -> new) for re-linking
        word_map: dict[str, str] = {}
        char_map: dict[str, str] = {}
        pass_map: dict[str, str] = {}
        feature_map: dict[str, str] = {}

        def get_or_create_language(lang) -> str:
            """Dedupe by target ISO code: merge into the collaborator's existing language."""
            existing = session.query(Language).filter(
                Language.user_id == collaborator_id,
                Language.target_iso639_2t == lang.target_iso639_2t,
            ).first()
            if existing:
                # apply master's tags/sources to the invitee's language (description untouched)
                for tag in lang.tags:
                    if tag not in existing.tags:
                        existing.tags.append(tag)
                for source in lang.sources:
                    if source not in existing.sources:
                        existing.sources.append(source)
                return existing.id
            new_lang = clone(Language, user_id=collaborator_id, name=lang.name, alias=lang.alias,
                             flag=lang.flag, level=lang.level, description=lang.description,
                             source_iso639_2t=lang.source_iso639_2t, target_iso639_2t=lang.target_iso639_2t)
            session.flush()
            return new_lang.id

        if target_type == "language":
            lang = session.query(Language).filter(Language.id == target_id).first()
            if not lang:
                return
            new_lang_id = get_or_create_language(lang)
            lessons = session.query(Lesson).filter(Lesson.language_id == target_id).all()
        else:
            lesson = session.query(Lesson).filter(Lesson.id == target_id).first()
            if not lesson:
                return
            # lesson fork: also fork the parent language so the lesson has a home
            plang = session.query(Language).filter(Language.id == lesson.language_id).first()
            new_lang_id = get_or_create_language(plang)
            lessons = [lesson]

        # components under the (original) language
        orig_lang_id = target_id if target_type == "language" else lessons[0].language_id
        def get_or_create_component(model, key_field, key_value, **fields):
            existing = session.query(model).filter(
                model.language_id == new_lang_id,
                getattr(model, key_field) == key_value,
            ).first()
            return existing.id if existing else clone(model, language_id=new_lang_id, **fields).id

        for w in session.query(Word).filter(Word.language_id == orig_lang_id).all():
            word_map[w.id] = get_or_create_component(Word, "word", w.word, word=w.word, translation=w.translation,
                                                     phonetic=w.phonetic, word_type=w.word_type, word_gender=w.word_gender)
        for c in session.query(Character).filter(Character.language_id == orig_lang_id).all():
            char_map[c.id] = get_or_create_component(Character, "character", c.character, character=c.character,
                                                     phonetic=c.phonetic, meaning=c.meaning, radical=c.radical, strokes=c.strokes)
        for p in session.query(Passage).filter(Passage.language_id == orig_lang_id).all():
            pass_map[p.id] = get_or_create_component(Passage, "text", p.text, text=p.text, translation=p.translation)

        # lessons + features
        for lesson in lessons:
            new_lesson = clone(Lesson, user_id=collaborator_id, language_id=new_lang_id,
                               title=lesson.title, level=lesson.level, description=lesson.description)
            session.flush()
            for v in session.query(Vocabulary).filter(Vocabulary.lesson_id == lesson.id).all():
                nv = clone(Vocabulary, lesson_id=new_lesson.id, word_id=word_map.get(v.word_id, v.word_id))
                feature_map[v.id] = nv.id
            for g in session.query(Grammar).filter(Grammar.lesson_id == lesson.id).all():
                ng = clone(Grammar, lesson_id=new_lesson.id, title=g.title, explanation=g.explanation)
                feature_map[g.id] = ng.id
            for c in session.query(Calligraphy).filter(Calligraphy.lesson_id == lesson.id).all():
                nc = clone(Calligraphy, lesson_id=new_lesson.id, character_id=char_map.get(c.character_id, c.character_id))
                feature_map[c.id] = nc.id
            for e in session.query(Exercise).filter(Exercise.lesson_id == lesson.id).all():
                ne = clone(Exercise, lesson_id=new_lesson.id, exercise_type=e.exercise_type, question=e.question,
                           answer=e.answer, text_support=e.text_support, content=e.content)
                feature_map[e.id] = ne.id

        # map the collaborator's progress (old element id -> new element id)
        element_map: dict[str, str] = {}
        element_map.update(word_map)
        element_map.update(char_map)
        element_map.update(pass_map)
        element_map.update(feature_map)
        for sc in session.query(Score).filter(
                Score.user_id == collaborator_id).all():
            if sc.element_id in element_map:
                sc.element_id = element_map[sc.element_id]
        session.flush()

    @transactional
    def merge_language(self, source_language_id: str, target_language_id: str,
                       collaborator_id: str, session: Optional[Session] = None) -> None:
        """Merge `source` language's lessons into `target`, remap the collaborator's Score, delete `source`."""
        from ...models.containers import Language, Lesson
        from ...models.components import Word, Character, Passage
        from ...models.features import Vocabulary, Grammar, Calligraphy, Exercise
        from ...models.system_data import Score

        target = session.query(Language).filter(Language.id == target_language_id).first()
        if not target:
            return
        target_owner = target.user_id

        def clone(model, **fields):
            obj = model(id=db_manager.generate_new_id(model, session=session), **fields)
            session.add(obj)
            return obj

        word_map: dict[str, str] = {}
        char_map: dict[str, str] = {}
        pass_map: dict[str, str] = {}
        feature_map: dict[str, str] = {}

        def get_or_create_component(model, key_field, key_value, **fields):
            existing = session.query(model).filter(
                model.language_id == target_language_id,
                getattr(model, key_field) == key_value,
            ).first()
            return existing.id if existing else clone(model, language_id=target_language_id, **fields).id

        for w in session.query(Word).filter(Word.language_id == source_language_id).all():
            word_map[w.id] = get_or_create_component(Word, "word", w.word, word=w.word, translation=w.translation,
                                                     phonetic=w.phonetic, word_type=w.word_type, word_gender=w.word_gender)
        for c in session.query(Character).filter(Character.language_id == source_language_id).all():
            char_map[c.id] = get_or_create_component(Character, "character", c.character, character=c.character,
                                                     phonetic=c.phonetic, meaning=c.meaning, radical=c.radical, strokes=c.strokes)
        for p in session.query(Passage).filter(Passage.language_id == source_language_id).all():
            pass_map[p.id] = get_or_create_component(Passage, "text", p.text, text=p.text, translation=p.translation)

        for lesson in session.query(Lesson).filter(Lesson.language_id == source_language_id).all():
            new_lesson = clone(Lesson, user_id=target_owner, language_id=target_language_id,
                               title=lesson.title, level=lesson.level, description=lesson.description)
            session.flush()
            for v in session.query(Vocabulary).filter(Vocabulary.lesson_id == lesson.id).all():
                nv = clone(Vocabulary, lesson_id=new_lesson.id, word_id=word_map.get(v.word_id, v.word_id))
                feature_map[v.id] = nv.id
            for g in session.query(Grammar).filter(Grammar.lesson_id == lesson.id).all():
                ng = clone(Grammar, lesson_id=new_lesson.id, title=g.title, explanation=g.explanation)
                feature_map[g.id] = ng.id
            for c in session.query(Calligraphy).filter(Calligraphy.lesson_id == lesson.id).all():
                nc = clone(Calligraphy, lesson_id=new_lesson.id, character_id=char_map.get(c.character_id, c.character_id))
                feature_map[c.id] = nc.id
            for e in session.query(Exercise).filter(Exercise.lesson_id == lesson.id).all():
                ne = clone(Exercise, lesson_id=new_lesson.id, exercise_type=e.exercise_type, question=e.question,
                           answer=e.answer, text_support=e.text_support, content=e.content)
                feature_map[e.id] = ne.id

        element_map: dict[str, str] = {}
        element_map.update(word_map)
        element_map.update(char_map)
        element_map.update(pass_map)
        element_map.update(feature_map)
        for sc in session.query(Score).filter(Score.user_id == collaborator_id).all():
            if sc.element_id in element_map:
                sc.element_id = element_map[sc.element_id]

        source = session.query(Language).filter(Language.id == source_language_id).first()
        if source:
            session.delete(source)
        session.flush()

    def is_collaborator(self, user_id: str, target_type: str, target_id: str,
                        session: Optional[Session] = None) -> bool:
        if session is not None:
            return self._is_collaborator(user_id, target_type, target_id, session)
        with db_manager.session_scope() as s:
            return self._is_collaborator(user_id, target_type, target_id, s)

    def _is_collaborator(self, user_id, target_type, target_id, session) -> bool:
        return session.query(Collaboration).filter(
            Collaboration.collaborator_id == user_id,
            Collaboration.target_type == target_type,
            Collaboration.target_id == target_id,
            Collaboration.status == "accepted",
            or_(Collaboration.mode.is_(None), Collaboration.mode == "full"),
        ).first() is not None

    @transactional
    def list_collaborators(self, target_type: str, target_id: str,
                           session: Optional[Session] = None) -> list[dict]:
        collabs = session.query(Collaboration).filter(
            Collaboration.target_type == target_type,
            Collaboration.target_id == target_id,
        ).all()
        return [{"id": c.id, "collaborator_id": c.collaborator_id, "status": c.status} for c in collabs]

    @transactional
    def list_collaborated_target_ids(self, user_id: str, target_type: str,
                                     session: Optional[Session] = None) -> list[str]:
        collabs = session.query(Collaboration).filter(
            Collaboration.collaborator_id == user_id,
            Collaboration.target_type == target_type,
            Collaboration.status == "accepted",
            or_(Collaboration.mode.is_(None), Collaboration.mode == "full"),
        ).all()
        return [c.target_id for c in collabs]

    @transactional
    def list_invites(self, user_id: str, session: Optional[Session] = None) -> list[dict]:
        from ...models.containers import Language, Lesson
        from ...models.system_data import User
        from ...utils.detect_language import get_language_by_iso2t

        collabs = session.query(Collaboration).filter(
            Collaboration.collaborator_id == user_id,
            Collaboration.status == "pending",
        ).all()

        result = []
        for c in collabs:
            master = session.query(User).filter(User.id == c.master_id).first()
            master_name = (master.display_name or master.username) if master else c.master_id

            lang = None
            if c.target_type == "language":
                lang = session.query(Language).filter(Language.id == c.target_id).first()
            elif c.target_type == "lesson":
                lesson = session.query(Lesson).filter(Lesson.id == c.target_id).first()
                if lesson:
                    lang = session.query(Language).filter(Language.id == lesson.language_id).first()

            result.append({
                "id": c.id,
                "master_id": c.master_id,
                "master_name": master_name,
                "target_type": c.target_type,
                "target_id": c.target_id,
                "language_name": lang.name if lang else None,
                "source_language": get_language_by_iso2t(lang.source_iso639_2t).name if lang else None,
                "target_language": get_language_by_iso2t(lang.target_iso639_2t).name if lang else None,
                "lessons": self._target_lessons(c, session),
            })
        return result

    def _target_lessons(self, collab, session) -> list[dict]:
        """The master's lessons for a language target, for the partial-sync selector."""
        from ...models.containers import Lesson
        if collab.target_type != "language":
            return []
        lessons = session.query(Lesson).filter(Lesson.language_id == collab.target_id).all()
        return [{"id": l.id, "title": l.title, "description": l.description, "level": l.level} for l in lessons]
