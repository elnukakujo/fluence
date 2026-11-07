"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { deleteExercise, getExercisesByLesson, updateExercise } from "@/api/exercise";
import ExerciseBody from "@/components/ingestion/exerciseBody";
import ExerciseEditor from "@/components/ingestion/exerciseEditor";
import { EXERCISE_TYPE_KEY } from "@/i18n/exerciseTypes";
import type Exercise from "@/interface/features/Exercise";
import type { Row } from "@/lib/ingestion/review";

type Entry = { id: string; reason: string; row: Row };

// The import review's per-type body and editors want a Row; a stored exercise needs only the exercise fields of it.
const toEntry = (e: Exercise): Entry => ({
    id: e.id!, reason: e.review_reason ?? "",
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
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        getExercisesByLesson(lessonId).then((list: Exercise[]) => setEntries(list.filter((e) => e.review_reason).map(toEntry)), () => setError("failed"));
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
                                      content: (r.content ?? undefined) as Exercise["content"], lesson_id: lessonId, review_reason: null });
        return e.id;
    };
    const remove = async (e: Entry) => { await deleteExercise(e.id); return e.id; };
    const patch = (id: string, p: Partial<Row>) => setEntries((cur) => (cur ?? []).map((e) => (e.id === id ? { ...e, row: { ...e.row, ...p } } : e)));

    return (
        <div className="dialog-backdrop" onKeyDown={(ev) => { if (ev.key === "Escape") finish(); }}>
            <div className="dialog max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="review-title">
                <h2 id="review-title" className="text-lg font-semibold">{t("reviewTitle")}</h2>
                <p className="text-sm text-muted">{t("reviewIntro")}</p>
                {entries === null && !error && <p role="status">{t("generateLoading")}</p>}
                {error && <p role="alert" className="text-red-600">{t("reviewFailed")}</p>}
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
                                        <span className="badge badge-warn"><span className="sr-only">{t("reviewReasonLabel")}: </span>{e.reason}</span>
                                    </p>
                                    {editing.includes(e.id)
                                        ? <ExerciseEditor row={e.row} onChange={(p) => patch(e.id, p)} />
                                        : <ExerciseBody row={e.row} />}
                                    <div className="flex flex-wrap gap-2">
                                        <button type="button" className="btn btn-primary min-h-11" disabled={busy} onClick={() => run(async () => [await accept(e)])}>{t("reviewAccept")}</button>
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
