"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Modal from "@/components/ui/dialogs/modal";
import VocabularyForm from "@/components/elements/vocabularyForm";
import GrammarForm from "@/components/elements/grammarForm";
import CalligraphyForm from "@/components/elements/calligraphyForm";
import ExerciseForm from "@/components/exercises/exerciseForm";
import Spinner from "@/components/ui/spinner";
import type { ReviewCard } from "@/api/review";
import { getVocabularyById, getVocabularyByLesson } from "@/api/vocabulary";
import { getGrammarById, getGrammarByLesson } from "@/api/grammar";
import { getCalligraphyById, getCalligraphyByLesson } from "@/api/calligraphy";
import { getCharacterById, listRadicals } from "@/api/character";
import { getExerciseById } from "@/api/exercise";
import { getLanguageById } from "@/api/language";

/** The element's own update form in a dialog over the review, so a mistake seen during the review is fixed on the spot and the
 *  session (queue, scores, position) is untouched. `onSaved` gets the fresh element; closing cancels. */
export default function EditElementDialog({ card, languageId, onSaved, onClose }: {
    card: ReviewCard; languageId: string; onSaved: (fresh: ReviewCard) => void; onClose: () => void;
}) {
    const t = useTranslations("elements");
    const [form, setForm] = useState<React.ReactNode>(null);
    const [error, setError] = useState(false);
    const lessonId = card.lesson_id!;

    useEffect(() => {
        let stale = false;
        const done = (get: () => Promise<ReviewCard>) => () => get().then(onSaved).then(onClose).catch(() => setError(true));
        (async () => {
            switch (card.kind) {
                case "vocabulary": {
                    const v = await getVocabularyById(card.id!);
                    return <VocabularyForm vocabulary={v} lesson_id={lessonId} onDone={done(() => getVocabularyById(card.id!))} />;
                }
                case "grammar": {
                    const g = await getGrammarById(card.id!);
                    return <GrammarForm grammar={g} lesson_id={lessonId} onDone={done(() => getGrammarById(card.id!))} />;
                }
                case "calligraphy": {   // as the update page: the typed components and the radicals to pick from
                    const c = await getCalligraphyById(card.id!);
                    const [links, radicalOptions] = await Promise.all([getCharacterById(c.character.id!), listRadicals(languageId)]);
                    c.character = { ...c.character, component_glyphs: (links.component_refs ?? []).map((r: { character: string }) => r.character) };
                    return <CalligraphyForm calligraphy={c} lesson_id={lessonId} radicalOptions={radicalOptions} onDone={done(() => getCalligraphyById(card.id!))} />;
                }
                default: {
                    const [exercise, language, vocabularies, grammars, calligraphies] = await Promise.all([
                        getExerciseById(card.id!), getLanguageById(languageId), getVocabularyByLesson(lessonId), getGrammarByLesson(lessonId), getCalligraphyByLesson(lessonId),
                    ]);
                    return <ExerciseForm exercise={exercise} lesson_id={lessonId} languageIso={language.target_iso639_2t}
                        lessonElements={{ vocabularies, grammars, calligraphies }} onDone={done(() => getExerciseById(card.id!))} />;
                }
            }
        })().then((f) => { if (!stale) setForm(f); }).catch(() => { if (!stale) setError(true); });
        return () => { stale = true; };
    }, [card.id]);

    return (
        <Modal wide title={t("editElement")} onClose={onClose}>
            {error ? <p role="alert" className="text-sm text-danger">{t("editLoadFailed")}</p> : form ?? <Spinner />}
        </Modal>
    );
}
