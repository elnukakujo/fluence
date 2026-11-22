"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { deleteExercise, getExercisesByLesson, redoExercise, updateExercise } from "@/api/exercise";
import { getVocabularyByLesson } from "@/api/vocabulary";
import { getGrammarByLesson } from "@/api/grammar";
import { getCalligraphyByLesson } from "@/api/calligraphy";
import OpenCloseMenu from "@/components/ui/selectMenu/openCloseMenu";
import RegenerateForm from "@/components/ingestion/regenerateForm";
import type Vocabulary from "@/interface/features/Vocabulary";
import type Grammar from "@/interface/features/Grammar";
import type Calligraphy from "@/interface/features/Calligraphy";
import ExerciseBody from "@/components/ingestion/exerciseBody";
import ExerciseEditor from "@/components/ingestion/exerciseEditor";
import { EXERCISE_TYPE_KEY } from "@/i18n/exerciseTypes";
import type Exercise from "@/interface/features/Exercise";
import type { Row } from "@/lib/ingestion/review";
import InlineError from "@/components/ui/inlineError";

type Links = { related_vocabulary: string[]; related_grammar: string[]; related_calligraphy: string[] };
type Entry = { id: string; reason: string; row: Row; links: Links };
type Lesson = { vocabularies: Vocabulary[]; grammars: Grammar[]; calligraphies: Calligraphy[] };

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
    const [editing, setEditing] = useState<string[]>([]);
    const [lesson, setLesson] = useState<Lesson | null>(null);           // the lesson's elements: what an exercise can be linked to (EG-25)
    const [redoing, setRedoing] = useState<string | null>(null);          // entry whose "redo" form is open
    const [redoBusy, setRedoBusy] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        getExercisesByLesson(lessonId).then((list: Exercise[]) => setEntries(list.filter((e) => e.draft || e.review_reason).map(toEntry)), () => setError("failed"));
        Promise.all([getVocabularyByLesson(lessonId), getGrammarByLesson(lessonId), getCalligraphyByLesson(lessonId)])
            .then(([vocabularies, grammars, calligraphies]) => setLesson({ vocabularies, grammars, calligraphies }), () => setLesson(null));
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
    const redo = async (e: Entry, type?: string) => {          // the model rebuilds it from its linked elements; the review shows the result, Accept stores it
        setRedoBusy(true);
        setError("");
        try {
            const r = await redoExercise(e.id, type);
            setEntries((cur) => (cur ?? []).map((x) => (x.id === e.id ? { ...x, reason: r.review_reason ?? "", links: r.links,
                row: { ...x.row, exercise_type: r.exercise_type, question: r.question, answer: r.answer, text_support: r.text_support, content: (r.content ?? null) as Row["content"] } } : x)));
            setRedoing(null);
        } catch { setError("failed"); } finally { setRedoBusy(false); }
    };
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
                        <div className="flex flex-wrap gap-2">
                            <button type="button" className="btn btn-primary min-h-11" disabled={busy} onClick={() => run(async () => { const ids: string[] = []; for (const e of entries) ids.push(await accept(e)); return ids; })}>{t("reviewAcceptAll")}</button>
                            <button type="button" className="btn btn-secondary min-h-11" disabled={busy} onClick={() => run(async () => { const ids: string[] = []; for (const e of entries) ids.push(await remove(e)); return ids; })}>{t("reviewDeleteAll")}</button>
                        </div>
                        <ul className="flex list-none flex-col gap-3 p-0">
                            {entries.map((e) => (
                                <li key={e.id} className="card flex flex-col gap-2">
                                    <p className="flex flex-wrap items-center gap-2">
                                        <span className="badge">{EXERCISE_TYPE_KEY[e.row.exercise_type ?? ""] ? t(EXERCISE_TYPE_KEY[e.row.exercise_type ?? ""]) : e.row.exercise_type}</span>
                                        {e.reason && <span className="badge badge-warn"><span className="sr-only">{t("reviewReasonLabel")}: </span>{e.reason}</span>}
                                    </p>
                                    {editing.includes(e.id)
                                        ? <ExerciseEditor row={e.row} onChange={(p) => patch(e.id, p)} />
                                        : <ExerciseBody row={e.row} />}
                                    {lesson && (
                                        <details className="flex flex-col gap-2">
                                            <summary className="cursor-pointer text-sm font-medium">{t("reviewAssociations")}</summary>
                                            <div className="flex flex-col items-baseline gap-3 pt-2">
                                                <OpenCloseMenu elements={lesson.vocabularies.map((v) => ({ id: v.id!, value: `${v.word.word} - ${v.word.translation}` }))}
                                                    selectedElements={e.links.related_vocabulary} setSelectedElements={(v) => setLinks(e.id, { related_vocabulary: v as string[] })} label={t("associatedVocabulary")} />
                                                <OpenCloseMenu elements={lesson.grammars.map((g) => ({ id: g.id!, value: g.title }))}
                                                    selectedElements={e.links.related_grammar} setSelectedElements={(v) => setLinks(e.id, { related_grammar: v as string[] })} label={t("associatedGrammar")} />
                                                <OpenCloseMenu elements={lesson.calligraphies.map((c) => ({ id: c.id!, value: `${c.character.character} - ${c.character.phonetic}` }))}
                                                    selectedElements={e.links.related_calligraphy} setSelectedElements={(v) => setLinks(e.id, { related_calligraphy: v as string[] })} label={t("associatedCalligraphies")} />
                                            </div>
                                        </details>
                                    )}
                                    {redoing === e.id && <RegenerateForm withRequest={false} busy={redoBusy} goLabel={t("reviewRedoGo")} onSubmit={(o) => redo(e, o.exercise_type)} onCancel={() => setRedoing(null)} />}
                                    <div className="flex flex-wrap gap-2">
                                        <button type="button" className="btn btn-primary min-h-11" disabled={busy} onClick={() => run(async () => [await accept(e)])}>{t("reviewAccept")}</button>
                                        <button type="button" className="btn btn-secondary min-h-11" disabled={busy || redoBusy} aria-expanded={redoing === e.id} onClick={() => setRedoing(redoing === e.id ? null : e.id)}>{t("reviewRedo")}</button>
                                        <button type="button" className="btn btn-secondary min-h-11" aria-expanded={editing.includes(e.id)}
                                            onClick={() => setEditing((cur) => (cur.includes(e.id) ? cur.filter((i) => i !== e.id) : [...cur, e.id]))}>{t("reviewEdit")}</button>
                                        <button type="button" className="btn btn-secondary min-h-11" disabled={busy} onClick={() => run(async () => [await remove(e)])}>{t("reviewDelete")}</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
                <div className="flex justify-end">
                    <button ref={closeRef} type="button" className="btn btn-secondary min-h-11" onClick={finish}>{t("reviewLater")}</button>
                </div>
            </div>
        </div>
    );
}
