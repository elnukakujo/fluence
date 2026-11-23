"use client";

import { ALL_TYPES, getStudiedTypes, studiedElements } from "@/lib/studiedTypes";
import { getLessonById } from "@/api/lesson";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { deleteExercise, getExercisesByLesson, redoExercise, updateExercise } from "@/api/exercise";
import { getVocabularyByLesson } from "@/api/vocabulary";
import { getGrammarByLesson } from "@/api/grammar";
import { getCalligraphyByLesson } from "@/api/calligraphy";
import ClassicSelectMenu from "@/components/ui/selectMenu/classicSelectMenu";
import type Vocabulary from "@/interface/features/Vocabulary";
import type Grammar from "@/interface/features/Grammar";
import type Calligraphy from "@/interface/features/Calligraphy";
import ExerciseReviewCard from "@/components/ingestion/exerciseReviewCard";
import { switchesInPlace } from "@/lib/ingestion/exerciseEdit";
import type Exercise from "@/interface/features/Exercise";
import type { Row } from "@/lib/ingestion/review";
import InlineError from "@/components/ui/inlineError";

type Links = { related_vocabulary: string[]; related_grammar: string[]; related_calligraphy: string[] };
type Entry = { id: string; reason: string; row: Row; links: Links };
type Lesson = { vocabularies?: Vocabulary[]; grammars?: Grammar[]; calligraphies?: Calligraphy[] };      // undefined = the course does not study that type

// The import review's per-type body and editors want a Row; a stored exercise needs only the exercise fields of it.
const toEntry = (e: Exercise): Entry => ({
    id: e.id!, reason: e.review_reason ?? "",
    links: { related_vocabulary: e.related_vocabulary ?? [], related_grammar: e.related_grammar ?? [], related_calligraphy: e.related_calligraphy ?? [] },
    row: { candidate: { id: e.id!, quote: "", page: 0, chunk_id: "", status: "verified", flags: [], min_conf: null, kind: "exercise" },
           selected: false, on_conflict: null, exercise_type: e.exercise_type, question: e.question, answer: e.answer,
           text_support: e.text_support ?? null, content: (e.content ?? null) as Row["content"] },
});

/** Step 2 of generation: the exercises the checks or the judge doubted, each with its reason: Accept (clears the flag), Edit, Delete, or all at once. */
export default function GenerationReview({ lessonId, onClose }: { lessonId: string; onClose: () => void }) {
    const t = useTranslations("exercises");
    const router = useRouter();
    const [entries, setEntries] = useState<Entry[] | null>(null);
    const [lesson, setLesson] = useState<Lesson | null>(null);           // the lesson's elements: what an exercise can be linked to (EG-25)
    const [rebuildingId, setRebuildingId] = useState<string | null>(null);   // the entry the model is rebuilding
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        getExercisesByLesson(lessonId).then((list: Exercise[]) => setEntries(list.filter((e) => e.draft || e.review_reason).map(toEntry)), () => setError("failed"));
        Promise.all([getVocabularyByLesson(lessonId), getGrammarByLesson(lessonId), getCalligraphyByLesson(lessonId),
            getLessonById(lessonId).then((l) => getStudiedTypes(l.language_id)).catch(() => ALL_TYPES)])
            .then(([vocabularies, grammars, calligraphies, types]) => setLesson(studiedElements(types, { vocabularies, grammars, calligraphies })), () => setLesson(null));
    }, [lessonId]);

    const finish = () => { router.refresh(); onClose(); };
    useEffect(() => { if (entries && entries.length === 0) finish(); }, [entries]);   // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (entries) closeRef.current?.focus(); }, [entries === null]);   // eslint-disable-line react-hooks/exhaustive-deps

    const drop = (ids: string[]) => setEntries((cur) => (cur ?? []).filter((e) => !ids.includes(e.id)));
    const run = async (work: () => Promise<string[]>) => {
        setBusy(true);
        setError("");
        try { drop(await work()); } catch { setError("failed"); } finally { setBusy(false); }
    };
    const accept = async (e: Entry) => {
        const r = e.row;
        await updateExercise(e.id, { exercise_type: r.exercise_type as Exercise["exercise_type"], question: r.question, answer: r.answer, text_support: r.text_support ?? undefined,
                                      content: (r.content ?? undefined) as Exercise["content"], lesson_id: lessonId, review_reason: null, draft: false, ...e.links });
        return e.id;
    };
    const remove = async (e: Entry) => { await deleteExercise(e.id); return e.id; };
    const setLinks = (id: string, links: Partial<Links>) => setEntries((cur) => (cur ?? []).map((e) => (e.id === id ? { ...e, links: { ...e.links, ...links } } : e)));
    const redo = async (e: Entry, type?: string): Promise<boolean> => {          // the model rebuilds it from its linked elements; the review shows the result, Confirm stores it
        setRebuildingId(e.id);
        setError("");
        try {
            const r = await redoExercise(e.id, type);
            setEntries((cur) => (cur ?? []).map((x) => (x.id === e.id ? { ...x, reason: r.review_reason ?? "", links: r.links,
                row: { ...x.row, exercise_type: r.exercise_type, question: r.question, answer: r.answer, text_support: r.text_support, content: (r.content ?? null) as Row["content"] } } : x)));
            return true;
        } catch { setError("failed"); return false; } finally { setRebuildingId(null); }
    };
    const changeType = (e: Entry, to: string) => (switchesInPlace(e.row.exercise_type, to) ? patch(e.id, { exercise_type: to }) : void redo(e, to));
    const patch = (id: string, p: Partial<Row>) => setEntries((cur) => (cur ?? []).map((e) => (e.id === id ? { ...e, row: { ...e.row, ...p } } : e)));

    return (
        <div className="dialog-backdrop" onKeyDown={(ev) => { if (ev.key === "Escape") finish(); }}>
            <div className="dialog max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="review-title">
                <h2 id="review-title" className="text-lg font-semibold">{t("reviewTitle")}</h2>
                <p className="text-sm text-muted">{t("reviewIntro")}</p>
                {entries === null && !error && <p role="status">{t("generateLoading")}</p>}
                {error && <InlineError>{t("reviewFailed")}</InlineError>}
                {entries && entries.length > 0 && (
                    <>
                        <div className="btn-row flex-wrap">
                            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(async () => { const ids: string[] = []; for (const e of entries) ids.push(await accept(e)); return ids; })}>{t("reviewAcceptAll")}</button>
                            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => run(async () => { const ids: string[] = []; for (const e of entries) ids.push(await remove(e)); return ids; })}>{t("reviewDeleteAll")}</button>
                        </div>
                        <ul className="m-0 flex list-none flex-col gap-2 p-0">
                            {entries.map((e) => (
                                <ExerciseReviewCard key={e.id} row={e.row} badge={t("reviewDraftBadge")} badgeTitle={t("reviewDraftTitle")}
                                    footer={e.reason ? <ul className="list-disc pl-5 text-sm" aria-label={t("reviewReasonLabel")}><li>{e.reason}</li></ul> : undefined}
                                    rebuilding={rebuildingId === e.id} withRequest={false} rebuildGoLabel={t("reviewRedoGo")} busy={busy}
                                    onPatch={() => {}} onEdit={(p) => patch(e.id, p)} onChangeType={(to) => changeType(e, to)} onRebuild={(o) => redo(e, o.exercise_type)}
                                    onConfirm={() => run(async () => [await accept(e)])} onDelete={() => run(async () => [await remove(e)])}
                                    extra={lesson && (
                                        <details className="flex flex-col gap-2">
                                            <summary className="min-h-11 cursor-pointer text-sm font-medium">{t("reviewAssociations")}</summary>
                                            <div className="flex flex-col gap-3 pt-2">
                                                {lesson.vocabularies && <Associated label={t("associatedVocabulary")} elements={lesson.vocabularies.map((v) => ({ id: v.id!, value: `${v.word.word} - ${v.word.translation}` }))}
                                                    selected={e.links.related_vocabulary} onChange={(v) => setLinks(e.id, { related_vocabulary: v })} />}
                                                {lesson.grammars && <Associated label={t("associatedGrammar")} elements={lesson.grammars.map((g) => ({ id: g.id!, value: g.title }))}
                                                    selected={e.links.related_grammar} onChange={(v) => setLinks(e.id, { related_grammar: v })} />}
                                                {lesson.calligraphies && <Associated label={t("associatedCalligraphies")} elements={lesson.calligraphies.map((c) => ({ id: c.id!, value: `${c.character.character} - ${c.character.phonetic}` }))}
                                                    selected={e.links.related_calligraphy} onChange={(v) => setLinks(e.id, { related_calligraphy: v })} />}
                                            </div>
                                        </details>
                                    )} />
                            ))}
                        </ul>
                    </>
                )}
                <div className="flex justify-end">
                    <button ref={closeRef} type="button" className="btn btn-secondary" onClick={finish}>{t("reviewLater")}</button>
                </div>
            </div>
        </div>
    );
}

// What an exercise is linked to: the same dropdown as everywhere (several can be chosen; the chips show what is linked).
function Associated({ label, elements, selected, onChange }: { label: string; elements: { id: string; value: string }[]; selected: string[]; onChange: (ids: string[]) => void }) {
    const names = new Map(elements.map((e) => [e.id, e.value]));
    return <ClassicSelectMenu multiple label={label} className="w-full" options={elements.map((e) => e.id)} optionLabel={(id) => names.get(id)}
        selectedOption={selected} onChange={(v) => onChange(v as string[])} />;
}
