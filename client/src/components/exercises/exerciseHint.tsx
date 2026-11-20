"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Modal from "@/components/ui/dialogs/modal";
import HintButton from "@/components/elements/hintButton";
import GrammarCard from "@/components/elements/grammarCard";
import { getGrammarById } from "@/api/grammar";
import { getVocabularyById } from "@/api/vocabulary";
import { getCalligraphyById } from "@/api/calligraphy";
import { hintsTaken, takeHint } from "./creditExercise";
import type Exercise from "@/interface/features/Exercise";
import type Grammar from "@/interface/features/Grammar";
import type Vocabulary from "@/interface/features/Vocabulary";
import type Calligraphy from "@/interface/features/Calligraphy";

type Linked = { grammars: Grammar[]; vocabularies: Vocabulary[]; calligraphies: Calligraphy[] };

/** RC-25: the Hint of an exercise, the same button as on a vocabulary or calligraphy card. Step 1 opens the linked grammar sheet(s) in a dialog (a portal over the page);
 *  step 2 adds the related vocabulary and characters. Each step taken lowers what the attempt is credited (`creditExercise`); reading it again afterwards is free.
 *  An exercise with only words and characters linked has them as its one step; one linked to nothing opens a dialog that says so, at no cost. */
export default function ExerciseHint({ exercise }: { exercise: Exercise }) {
    const t = useTranslations("exercises");
    const id = exercise.id!;
    const [level, setLevel] = useState(() => hintsTaken(id));
    const [open, setOpen] = useState(false);
    const [linked, setLinked] = useState<Linked | null>(null);
    const hasGrammar = (exercise.related_grammar ?? []).length > 0;
    const hasWords = (exercise.related_vocabulary ?? []).length + (exercise.related_calligraphy ?? []).length > 0;
    const steps = (hasGrammar ? 1 : 0) + (hasGrammar && hasWords ? 1 : 0) + (!hasGrammar && hasWords ? 1 : 0) || 1;
    const ids = [exercise.related_grammar, exercise.related_vocabulary, exercise.related_calligraphy].map((a) => (a ?? []).join(",")).join("|");

    useEffect(() => { setLevel(hintsTaken(id)); setOpen(false); setLinked(null); }, [id]);
    useEffect(() => {
        if (!open || linked) return;
        let stale = false;
        const all = <T,>(list: string[] | undefined, get: (x: string) => Promise<T>) => Promise.all((list ?? []).map((x) => get(x).catch(() => null))).then((r) => r.filter(Boolean) as T[]);
        Promise.all([all(exercise.related_grammar, getGrammarById), all(exercise.related_vocabulary, getVocabularyById), all(exercise.related_calligraphy, getCalligraphyById)])
            .then(([grammars, vocabularies, calligraphies]) => { if (!stale) setLinked({ grammars, vocabularies, calligraphies }); });
        return () => { stale = true; };
    }, [open, linked, ids]); // eslint-disable-line react-hooks/exhaustive-deps

    const onClick = () => {
        const nothing = !hasGrammar && !hasWords;
        if (!nothing && level < steps) setLevel(takeHint(id));      // a step costs; reading again does not
        setOpen(true);
    };
    const showWords = level >= 2 || (!hasGrammar && level >= 1);      // the words and characters are step 2 (or step 1 when there is no grammar)
    const showGrammar = hasGrammar && level >= 1;
    return (
        <>
            <HintButton level={level} steps={steps} onClick={onClick} reopen />
            {open && (
                <Modal title={t("hintTitle")} subtitle={t("hintSubtitle")} onClose={() => setOpen(false)} wide>
                    {!linked ? <p role="status">{t("tipLoading")}</p> : !hasGrammar && !hasWords ? <p>{t("tipEmpty")}</p> : (
                        <div className="flex flex-col gap-5">
                            {showGrammar && linked.grammars.map((g) => (
                                <section key={g.id} className="flex flex-col gap-2" aria-label={t("grammarSheet", { title: g.title })}>
                                    <h3 className="font-medium">{t("grammarSheet", { title: g.title })}</h3>
                                    <GrammarCard grammar={g} />
                                </section>
                            ))}
                            {showWords && linked.vocabularies.length > 0 && (
                                <section className="flex flex-col gap-2" aria-label={t("tipVocabulary")}>
                                    <h3 className="font-medium">{t("tipVocabulary")}</h3>
                                    <ul className="m-0 flex list-none flex-col gap-1 p-0">
                                        {linked.vocabularies.map((v) => (
                                            <li key={v.id} className="flex flex-wrap items-baseline gap-x-3"><strong>{v.word.word}</strong>
                                                {v.word.phonetic && <span className="text-muted">{v.word.phonetic}</span>}<span>{v.word.translation}</span></li>
                                        ))}
                                    </ul>
                                </section>
                            )}
                            {showWords && linked.calligraphies.length > 0 && (
                                <section className="flex flex-col gap-2" aria-label={t("tipCalligraphy")}>
                                    <h3 className="font-medium">{t("tipCalligraphy")}</h3>
                                    <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-1 p-0">
                                        {linked.calligraphies.map((c) => (
                                            <li key={c.id} className="flex items-baseline gap-2"><strong className="text-xl">{c.character.character}</strong>
                                                {c.character.phonetic && <span className="text-muted">{c.character.phonetic}</span>}{c.character.meaning && <span>{c.character.meaning}</span>}</li>
                                        ))}
                                    </ul>
                                </section>
                            )}
                            {hasGrammar && hasWords && !showWords && <p className="text-sm text-muted">{t("hintMoreAvailable")}</p>}
                        </div>
                    )}
                </Modal>
            )}
        </>
    );
}
