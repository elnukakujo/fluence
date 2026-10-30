from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from ...core.database import db_manager, transactional
from ...models.system_data import Collaboration


class CollaborationService:
    @transactional
    def invite(self, master_id: str, collaborator_id: str, target_type: str, target_id: str,
               mode: Optional[str] = None, lesson_ids: Optional[list[str]] = None,
               session: Optional[Session] = None) -> Collaboration:
        """Invite a collaborator (idempotent). For a language target the master may offer `mode`
        ('full' | 'partial'; partial needs `lesson_ids` of that language). Lesson targets take neither."""
        from ...models.containers import Lesson
        if target_type == "lesson":
            if mode is not None or lesson_ids is not None:
                raise ValueError("a lesson invite takes no mode or lesson_ids")
        else:
            if mode not in (None, "full", "partial"):
                raise ValueError("mode must be 'full' or 'partial'")
            if mode == "partial":
                ids = set(lesson_ids or [])
                owned = {l for (l,) in session.query(Lesson.id).filter(
                    Lesson.language_id == target_id, Lesson.id.in_(ids)).all()} if ids else set()
                if not ids or owned != ids:
                    raise ValueError("a partial offer needs a non-empty list of this language's lessons")
            elif lesson_ids is not None:
                raise ValueError("lesson_ids only apply to a partial offer")
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
            proposed_mode=mode,
            offered_lesson_ids=list(lesson_ids) if mode == "partial" else None,
        )
        session.add(collab)
        session.flush()
        return collab

    @transactional
    def accept(self, collaboration_id: str, mode: Optional[str] = None,
               lesson_ids: Optional[list[str]] = None,
               session: Optional[Session] = None) -> Optional[Collaboration]:
        collab = session.query(Collaboration).filter(Collaboration.id == collaboration_id).first()
        if not collab or collab.status != "pending":
            return collab
        if collab.target_type == "lesson":
            self._accept_lesson(collab, session)
            return None
        if collab.target_type == "language" and collab.proposed_mode == "partial":
            lesson_ids = self._resolve_partial_offer(collab, mode, lesson_ids, session)
        collab.mode = mode
        if mode == "partial":
            if collab.target_type == "language":
                # If the invitee owns no language for the master's target ISO, give the
                # shared lessons a home: a one-time copy of the master's language metadata
                # (not shared). The chosen lessons stay shared pointers to the master's.
                self._replicate_language(collab.target_id, collab.collaborator_id, session=session)
            self.share_master_lessons(collab.master_id, collab.collaborator_id, collab.target_id,
                                      lesson_ids=lesson_ids, session=session)
            collab.status = "accepted"
        elif mode == "full" and self._has_collision(collab.collaborator_id, collab.target_id, session):
            collab.status = "awaiting_master_consent"
        else:
            collab.status = "accepted"
        session.flush()
        return collab

    def _accept_lesson(self, collab: Collaboration, session: Session) -> None:
        """A lesson-only invite is a pointer share: create the LessonShare and a couple-matched
        (or replicated) host language, then drop the invitation row (LessonShare is the access record)."""
        from ...models.containers import Lesson
        from .lesson_share import LessonShareService
        lesson = session.query(Lesson).filter(Lesson.id == collab.target_id).first()
        if lesson is not None:
            LessonShareService().share(lesson.id, collab.collaborator_id, session=session)
            self._replicate_language(lesson.language_id, collab.collaborator_id, session=session)
        session.delete(collab)
        session.flush()

    def _resolve_partial_offer(self, collab: Collaboration, mode: Optional[str],
                               lesson_ids: Optional[list[str]], session: Session) -> list[str]:
        """Validate an accept against the master's partial offer; returns the lessons to share.
        ValueError = the accept breaks the offer; LookupError = nothing offered still exists."""
        from ...models.containers import Lesson
        if mode != "partial":
            raise ValueError("this invitation only offers a partial collaboration")
        offered = set(collab.offered_lesson_ids or [])
        available = {l for (l,) in session.query(Lesson.id).filter(
            Lesson.language_id == collab.target_id, Lesson.id.in_(offered)).all()} if offered else set()
        if not available:
            raise LookupError("offer no longer available")
        if lesson_ids is None:
            return sorted(available)
        if not lesson_ids or not set(lesson_ids) <= available:
            raise ValueError("lesson_ids must be a non-empty subset of the offered lessons")
        return list(lesson_ids)

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

    def _replicate_language(self, language_id: str, collaborator_id: str,
                            session: Session) -> Optional[str]:
        """One-time copy of the master's language metadata into the collaborator's
        account (no lessons/components), so partial-sync lessons have a home language
        matching the master's target ISO. Returns the collaborator's language id."""
        from ...models.containers import Language
        from ...models.system_data import Tag, Source
        lang = session.query(Language).filter(Language.id == language_id).first()
        if not lang:
            return None
        existing = session.query(Language).filter(
            Language.user_id == collaborator_id,
            Language.target_iso639_2t == lang.target_iso639_2t,
            Language.source_iso639_2t == lang.source_iso639_2t,
        ).first()
        if existing:
            return existing.id
        name = lang.name
        if session.query(Language).filter(
                Language.user_id == collaborator_id, Language.name == name).first():
            name = f"{name} ({lang.target_iso639_2t})"  # uq_language_user_name
        new_lang = Language(
            id=db_manager.generate_new_id(Language, session=session),
            user_id=collaborator_id,
            name=name, alias=lang.alias, flag=lang.flag,
            level=lang.level, description=lang.description,
            source_iso639_2t=lang.source_iso639_2t, target_iso639_2t=lang.target_iso639_2t,
            created_at=lang.created_at,
        )
        session.add(new_lang)
        session.flush()

        self._copy_tags_sources(lang, new_lang, collaborator_id, session)
        session.flush()
        return new_lang.id

    def _copy_tags_sources(self, src_lang, dst_lang, user_id: str, session: Session) -> None:
        """Give `dst_lang` invitee-owned copies of `src_lang`'s tags/sources (never links to the
        master's rows). Reuses a same-named tag/source the user already owns."""
        from ...models.system_data import Tag, Source
        for tag in src_lang.tags:
            if any(t.name == tag.name for t in dst_lang.tags):
                continue
            dst_lang.tags.append(session.query(Tag).filter(
                Tag.user_id == user_id, Tag.name == tag.name).first() or Tag(
                id=db_manager.generate_new_id(Tag, session=session),
                user_id=user_id, name=tag.name, color=tag.color, description=tag.description))
        for source in src_lang.sources:
            if any(x.title == source.title for x in dst_lang.sources):
                continue
            dst_lang.sources.append(Source(
                id=db_manager.generate_new_id(Source, session=session),
                user_id=user_id, title=source.title, date=source.date,
                description=source.description, source_type=source.source_type))

    @transactional
    def ensure_shared_hosts(self, user_id: str, session: Optional[Session] = None) -> None:
        """Self-heal: every language holding lessons shared with `user_id` needs a host language
        of the same target ISO in their account, else those lessons are invisible. Idempotent."""
        from ...models.containers import Language, Lesson
        from ...models.system_data import LessonShare
        lang_ids = {l for (l,) in session.query(Lesson.language_id).join(
            LessonShare, LessonShare.lesson_id == Lesson.id).filter(
            LessonShare.user_id == user_id).all()}
        for lang_id in lang_ids:
            self._replicate_language(lang_id, user_id, session=session)

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
        from ...models.containers import Language
        from ...models.system_data import User
        collabs = session.query(Collaboration).filter(
            Collaboration.master_id == master_id,
            Collaboration.status == "awaiting_master_consent",
        ).all()
        result = []
        for c in collabs:
            user = session.query(User).filter(User.id == c.collaborator_id).first()
            lang = session.query(Language).filter(Language.id == c.target_id).first()
            result.append({"id": c.id, "collaborator_id": c.collaborator_id,
                           "collaborator_name": (user.display_name or user.username) if user else c.collaborator_id,
                           "target_id": c.target_id, "target_type": c.target_type, "mode": c.mode,
                           "language_name": lang.name if lang else None})
        return result

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
        elif collab.status == "accepted":
            # pending / awaiting-consent links never shared anything, so there is nothing to fork
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
            Collaboration.mode == "partial",
        ).all():
            session.delete(collab)

    def _remap_scores(self, user_id: str, element_map: dict[str, str],
                      lesson_map: dict[str, str], session: Session) -> None:
        """Repoint `user_id`'s Score rows from old element ids to new ones, and their
        `current_lesson_id` from old lesson ids to new ones. On a collision with a row
        already at the destination, the destination row wins and the old one is dropped."""
        from ...models.system_data import Score
        scores = session.query(Score).filter(Score.user_id == user_id).all()
        taken = {sc.element_id for sc in scores}
        for sc in scores:
            if sc.current_lesson_id in lesson_map:
                sc.current_lesson_id = lesson_map[sc.current_lesson_id]
            new_id = element_map.get(sc.element_id)
            if new_id is None or new_id == sc.element_id:
                continue
            if new_id in taken:
                # TODO: confirm with the owner which Score wins on collision (kept: destination row)
                session.delete(sc)
            else:
                sc.element_id = new_id
                taken.add(new_id)
        session.flush()

    def _fork(self, collaborator_id: str, target_type: str, target_id: str, session: Session) -> None:
        """Deep-copy the shared container + descendants into the collaborator's account, mapping progress."""
        from ...models.containers import Language, Lesson
        from ...models.components import Word, Character, Passage
        from ...models.features import Vocabulary, Grammar, Calligraphy, Exercise

        def clone(model, **fields):
            obj = model(id=db_manager.generate_new_id(model, session=session), **fields)
            session.add(obj)
            return obj

        # component/feature id maps (old -> new) for re-linking
        word_map: dict[str, str] = {}
        char_map: dict[str, str] = {}
        pass_map: dict[str, str] = {}
        feature_map: dict[str, str] = {}
        lesson_map: dict[str, str] = {}

        def get_or_create_language(lang) -> str:
            """Dedupe by target ISO code: merge into the collaborator's existing language."""
            existing = session.query(Language).filter(
                Language.user_id == collaborator_id,
                Language.target_iso639_2t == lang.target_iso639_2t,
            ).first()
            if existing:
                # apply master's tags/sources as invitee-owned copies (description untouched)
                self._copy_tags_sources(lang, existing, collaborator_id, session)
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
            lesson_map[lesson.id] = new_lesson.id
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
        element_map: dict[str, str] = {orig_lang_id: new_lang_id}
        element_map.update(word_map)
        element_map.update(char_map)
        element_map.update(pass_map)
        element_map.update(feature_map)
        self._remap_scores(collaborator_id, element_map, lesson_map, session)

    @transactional
    def merge_language(self, source_language_id: str, target_language_id: str,
                       collaborator_id: str, session: Optional[Session] = None) -> None:
        """Merge `source` language's lessons into `target`, remap the collaborator's Score, delete `source`."""
        from ...models.containers import Language, Lesson
        from ...models.components import Word, Character, Passage
        from ...models.features import Vocabulary, Grammar, Calligraphy, Exercise

        if source_language_id == target_language_id:
            return
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
        lesson_map: dict[str, str] = {}

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
            lesson_map[lesson.id] = new_lesson.id
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

        element_map: dict[str, str] = {source_language_id: target_language_id}
        element_map.update(word_map)
        element_map.update(char_map)
        element_map.update(pass_map)
        element_map.update(feature_map)
        self._remap_scores(collaborator_id, element_map, lesson_map, session)

        source = session.query(Language).filter(Language.id == source_language_id).first()
        if source:
            self._copy_tags_sources(source, target, target_owner, session)
            session.delete(source)
        session.flush()

    @transactional
    def has_partial_collaboration(self, master_id: str, collaborator_id: str, language_id: str,
                                  session: Optional[Session] = None) -> bool:
        """True if `collaborator_id` accepted a partial collaboration on `language_id` with `master_id`."""
        return session.query(Collaboration).filter(
            Collaboration.master_id == master_id,
            Collaboration.collaborator_id == collaborator_id,
            Collaboration.target_type == "language",
            Collaboration.target_id == language_id,
            Collaboration.status == "accepted",
            Collaboration.mode == "partial",
        ).first() is not None

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
        q = session.query(Collaboration).filter(
            Collaboration.target_type == target_type,
            Collaboration.target_id == target_id,
        )
        if target_type == "language":  # accepted partial invitees are lesson-level, not language collaborators
            q = q.filter(~((Collaboration.status == "accepted") & (Collaboration.mode == "partial")))
        collabs = q.all()
        return [{"id": c.id, "collaborator_id": c.collaborator_id, "status": c.status, "mode": c.mode}
                for c in collabs]

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
                "proposed_mode": c.proposed_mode,
                "lessons": self._target_lessons(c, session),
            })
        return result

    def _target_lessons(self, collab, session) -> list[dict]:
        """The master's lessons for a language target, for the partial-sync selector."""
        from ...models.containers import Lesson
        if collab.target_type != "language":
            return []
        q = session.query(Lesson).filter(Lesson.language_id == collab.target_id)
        if collab.proposed_mode == "partial":
            q = q.filter(Lesson.id.in_(collab.offered_lesson_ids or []))
        lessons = q.all()
        return [{"id": l.id, "title": l.title, "description": l.description, "level": l.level} for l in lessons]
