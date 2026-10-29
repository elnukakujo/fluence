from typing import Optional

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
    def accept(self, collaboration_id: str, session: Optional[Session] = None) -> Optional[Collaboration]:
        collab = session.query(Collaboration).filter(Collaboration.id == collaboration_id).first()
        if collab:
            collab.status = "accepted"
            session.flush()
        return collab

    @transactional
    def reject(self, collaboration_id: str, session: Optional[Session] = None) -> bool:
        collab = session.query(Collaboration).filter(Collaboration.id == collaboration_id).first()
        if not collab:
            return False
        session.delete(collab)
        return True

    @transactional
    def remove(self, collaboration_id: str, session: Optional[Session] = None) -> bool:
        """Fork the shared container into the collaborator's account, then delete the link."""
        collab = session.query(Collaboration).filter(Collaboration.id == collaboration_id).first()
        if not collab:
            return False
        self._fork(collab.collaborator_id, collab.target_type, collab.target_id, session)
        session.delete(collab)
        return True

    def _fork(self, collaborator_id: str, target_type: str, target_id: str, session: Session) -> None:
        """Deep-copy the shared container + descendants into the collaborator's account, mapping progress."""
        from ...models.containers import Language, Lesson
        from ...models.components import Word, Character, Passage
        from ...models.features import Vocabulary, Grammar, Calligraphy, Exercise
        from ...models.system_data import CollaborationProgress

        def clone(model, **fields):
            obj = model(id=db_manager.generate_new_id(model, session=session), **fields)
            session.add(obj)
            return obj

        # component/feature id maps (old -> new) for re-linking
        word_map: dict[str, str] = {}
        char_map: dict[str, str] = {}
        pass_map: dict[str, str] = {}
        feature_map: dict[str, str] = {}

        if target_type == "language":
            lang = session.query(Language).filter(Language.id == target_id).first()
            if not lang:
                return
            new_lang = clone(Language, user_id=collaborator_id, name=lang.name, alias=lang.alias,
                             flag=lang.flag, level=lang.level, description=lang.description,
                             source_iso639_2t=lang.source_iso639_2t, target_iso639_2t=lang.target_iso639_2t)
            session.flush()
            new_lang_id = new_lang.id
            lessons = session.query(Lesson).filter(Lesson.language_id == target_id).all()
        else:
            lesson = session.query(Lesson).filter(Lesson.id == target_id).first()
            if not lesson:
                return
            # lesson fork: also fork the parent language so the lesson has a home
            plang = session.query(Language).filter(Language.id == lesson.language_id).first()
            new_lang = clone(Language, user_id=collaborator_id, name=plang.name, alias=plang.alias,
                             flag=plang.flag, level=plang.level, description=plang.description,
                             source_iso639_2t=plang.source_iso639_2t, target_iso639_2t=plang.target_iso639_2t)
            session.flush()
            new_lang_id = new_lang.id
            lessons = [lesson]

        # components under the (original) language
        orig_lang_id = target_id if target_type == "language" else lessons[0].language_id
        for w in session.query(Word).filter(Word.language_id == orig_lang_id).all():
            word_map[w.id] = clone(Word, language_id=new_lang_id, word=w.word, translation=w.translation,
                                   phonetic=w.phonetic, word_type=w.word_type, word_gender=w.word_gender).id
        for c in session.query(Character).filter(Character.language_id == orig_lang_id).all():
            char_map[c.id] = clone(Character, language_id=new_lang_id, character=c.character,
                                   phonetic=c.phonetic, meaning=c.meaning, radical=c.radical, strokes=c.strokes).id
        for p in session.query(Passage).filter(Passage.language_id == orig_lang_id).all():
            pass_map[p.id] = clone(Passage, language_id=new_lang_id, text=p.text, translation=p.translation).id

        # lessons + features
        for lesson in lessons:
            new_lesson = clone(Lesson, user_id=collaborator_id, language_id=new_lang_id,
                               title=lesson.title, level=lesson.level, description=lesson.description)
            session.flush()
            for v in session.query(Vocabulary).filter(Vocabulary.lesson_id == lesson.id).all():
                nv = clone(Vocabulary, lesson_id=new_lesson.id, word_id=word_map.get(v.word_id, v.word_id),
                           score=0.0, difficulty=v.difficulty)
                feature_map[v.id] = nv.id
            for g in session.query(Grammar).filter(Grammar.lesson_id == lesson.id).all():
                ng = clone(Grammar, lesson_id=new_lesson.id, title=g.title, explanation=g.explanation,
                           score=0.0, difficulty=g.difficulty)
                feature_map[g.id] = ng.id
            for c in session.query(Calligraphy).filter(Calligraphy.lesson_id == lesson.id).all():
                nc = clone(Calligraphy, lesson_id=new_lesson.id, character_id=char_map.get(c.character_id, c.character_id),
                           score=0.0, difficulty=c.difficulty)
                feature_map[c.id] = nc.id
            for e in session.query(Exercise).filter(Exercise.lesson_id == lesson.id).all():
                ne = clone(Exercise, lesson_id=new_lesson.id, exercise_type=e.exercise_type, question=e.question,
                           answer=e.answer, text_support=e.text_support, content=e.content, score=0.0, difficulty=e.difficulty)
                feature_map[e.id] = ne.id

        # map the collaborator's progress (old element id -> new element id)
        element_map: dict[str, str] = {}
        element_map.update(word_map)
        element_map.update(char_map)
        element_map.update(pass_map)
        element_map.update(feature_map)
        for cp in session.query(CollaborationProgress).filter(
                CollaborationProgress.user_id == collaborator_id).all():
            if cp.element_id in element_map:
                cp.element_id = element_map[cp.element_id]
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
    def list_invites(self, user_id: str, session: Optional[Session] = None) -> list[dict]:
        collabs = session.query(Collaboration).filter(
            Collaboration.collaborator_id == user_id,
            Collaboration.status == "pending",
        ).all()
        return [{"id": c.id, "master_id": c.master_id, "target_type": c.target_type,
                 "target_id": c.target_id} for c in collabs]
