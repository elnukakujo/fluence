"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Minus, Plus, Sparkles, X } from "lucide-react";
import { getActiveGeneration, getGeneration, startGeneration, suggestGeneration, undoGenerationBatch, type GenerationJob } from "@/api/exercise";
import { EXERCISE_TYPE_KEY } from "@/i18n/exerciseTypes";
import GenerationReview from "./generationReview";
import GenerationProgress from "./generationProgress";
import { scaleMix } from "@/utils/scaleMix";
import { addable, free, resize, step, type Mix } from "@/utils/mixEdit";
import NumberField from "@/components/ui/input/numberField";

const MAX = 60;           // same cap as the server (GEN_MAX)
const POLL_MS = 2000;
type Phase = "closed" | "loading" | "configure" | "running" | "done" | "error";

/** "Generate exercises" button + dialog: pick how many, watch the progress, see what was saved and undo the batch. */
export default function GenerateDialog({ lessonId }: { lessonId: string }) {
    const t = useTranslations("exercises");
    const router = useRouter();
    const [phase, setPhase] = useState<Phase>("closed");
    const [suggestion, setSuggestion] = useState<{ count: number; mix: Mix; types?: string[] }>({ count: 0, mix: {} });
    const [mix, setMix] = useState<Mix>({});               // the planned mix, edited by the user; always generated as shown
    const [edited, setEdited] = useState(false);
    const [pick, setPick] = useState("");
    const [count, setCount] = useState("");
    const [job, setJob] = useState<GenerationJob | null>(null);
    const [jobId, setJobId] = useState<string | null>(null);
    const [error, setError] = useState<string>("");
    const dialogRef = useRef<HTMLDivElement>(null);
    const phaseRef = useRef(phase); phaseRef.current = phase;
    const tRef = useRef(t); tRef.current = t;      // the polling effect must not restart whenever the translator changes identity

    useEffect(() => { if (phase === "configure") dialogRef.current?.querySelector<HTMLInputElement>("input[type=number]")?.focus(); }, [phase]);

    useEffect(() => {
        if (!jobId || job?.state !== "running") return;
        let stopped = false;
        let timer: ReturnType<typeof setTimeout>;
        const poll = async () => {
            try {
                const next = await getGeneration(jobId);
                if (stopped) return;
                setJob(next);
                if (next.state === "done" && phaseRef.current === "closed") { setJob(null); setJobId(null); return router.refresh(); }     // finished in the background: just show the new exercises
                if (next.state === "done") return setPhase((p) => (p === "running" ? "done" : p));
                if (next.state === "failed") { setError(tRef.current("generateFailed", { error: next.error ?? "" })); return setPhase((p) => (p === "running" ? "error" : p)); }
            } catch (e) {
                if (stopped) return;
                if (phaseRef.current === "closed") { setJob(null); setJobId(null); return; }
                setError(e instanceof Error && e.message === "lost" ? tRef.current("generateLost") : tRef.current("generateFailed", { error: String(e) }));
                return setPhase((p) => (p === "closed" ? p : "error"));
            }
            timer = setTimeout(poll, POLL_MS);
        };
        timer = setTimeout(poll, POLL_MS);
        return () => { stopped = true; clearTimeout(timer); };
    }, [jobId, job?.state]);

    // a job left running (or failed) while the user was elsewhere: pick it up again
    useEffect(() => {
        getActiveGeneration(lessonId).then((found) => {
            if (!found) return;
            setJobId(found.job_id);
            setJob(found);
            if (found.state === "failed") setError(tRef.current("generateFailed", { error: found.error ?? "" }));
        }).catch(() => {});
    }, [lessonId]);

    const openDialog = async () => {
        setPhase("loading");
        setError("");
        try {
            const s = await suggestGeneration(lessonId);
            setSuggestion(s);
            setCount(String(s.count));
            setMix(s.mix);
            setEdited(false);
            setPick("");
            setPhase("configure");
        } catch (e) {
            setError(t("generateFailed", { error: String(e) }));
            setPhase("error");
        }
    };

    const close = () => {
        if (phase === "done") router.refresh();
        setPhase("closed");
        if (job?.state === "running") return;       // keeps running in the background; the button shows where it is at
        setJob(null);
        setJobId(null);
    };

    const start = async () => {
        const n = total;
        try {
            setJobId(await startGeneration(lessonId, n, mix));
            setJob({ state: "running", done: 0, total: n });
            setPhase("running");
        } catch (e) {
            setError(e instanceof Error && e.message === "text_gen_not_configured" ? t("generateNotConfigured")
                : e instanceof Error && e.message === "empty_lesson" ? t("generateNone") : t("generateFailed", { error: String(e) }));
            setPhase("error");
        }
    };

    const undo = async () => {
        try {
            await undoGenerationBatch(job!.result!.batch_id);
            setPhase("closed");
            router.refresh();
        } catch (e) {
            setError(t("generateFailed", { error: String(e) }));
            setPhase("error");
        }
    };

    const total = Math.min(MAX, parseInt(count, 10) || 0);
    const freeN = free(mix, total);
    const types = suggestion.types ?? Object.keys(suggestion.mix);        // the order the planner offers them in
    const rows = types.filter((ty) => ty in mix);
    const top = Math.max(1, ...Object.values(mix));
    const labelOf = (ty: string) => (EXERCISE_TYPE_KEY[ty] ? t(EXERCISE_TYPE_KEY[ty]) : ty);
    const change = (ty: string, delta: 1 | -1) => { setMix((m) => step(m, ty, delta, total)); setEdited(true); };
    const resizeTo = (v: number | "") => { setCount(String(v)); if (v !== "") setMix(resize(edited ? mix : suggestion.mix, Math.min(MAX, v))); };   // an emptied field keeps the mix
    const options = addable(types, mix);
    const review = phase === "done" && (job?.result?.flagged.length ?? 0) > 0;   // step 2 replaces the dialog
    return (
        <>
            <button type="button" className="btn btn-secondary min-h-11 inline-flex items-center gap-2"
                onClick={job?.state === "running" ? () => setPhase("running") : job?.state === "failed" ? () => setPhase("error") : openDialog}>
                <Sparkles size={16} aria-hidden />
                {job?.state === "running" ? t("generateRunningShort", { done: job.done, total: job.total }) : job?.state === "failed" ? t("generateFailedShort") : t("generateButton")}
            </button>
            {review && <GenerationReview lessonId={lessonId} onClose={close} />}
            {phase !== "closed" && !review && (
                <div className="dialog-backdrop" onKeyDown={(e) => { if (e.key === "Escape") close(); }}>
                    <div ref={dialogRef} className="dialog dialog-enter" style={{ width: "min(34rem, 100%)", gap: "1rem" }} role="dialog" aria-modal="true" aria-labelledby="generate-title">
                        <div className="flex items-start gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}>
                                <Sparkles size={18} aria-hidden />
                            </span>
                            <div className="min-w-0 flex-1">
                                <h2 id="generate-title" className="text-lg font-semibold">{t("generateTitle")}</h2>
                                <p className="text-sm text-muted">{t("generateSubtitle")}</p>
                            </div>
                            <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-accent-soft" aria-label={t("generateClose")} onClick={close}>
                                <X size={18} aria-hidden />
                            </button>
                        </div>

                        {phase === "loading" && <p role="status">{t("generateLoading")}</p>}

                        {phase === "configure" && (
                            suggestion.count === 0 ? <p className="callout">{t("generateNone")}</p> : (
                                <>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm font-medium">{t("generateCount")}</span>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <NumberField value={count === "" ? "" : Number(count)} onChange={resizeTo} min={1} max={MAX} ariaLabel={t("generateCount")} />
                                            <span className="text-sm text-muted">{t("generateSuggested", { count: suggestion.count, max: MAX })}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                            <p className="text-sm font-medium">{t("generateMix")}</p>
                                            <span className="text-sm text-muted" aria-live="polite">
                                                {t("generateMixPlaced", { placed: total - freeN, total })}{freeN > 0 && ` · ${t("generateMixFree", { free: freeN })}`}
                                            </span>
                                            <button type="button" className="btn btn-secondary btn-sm min-h-11 ml-auto" disabled={!edited}
                                                onClick={() => { setMix(scaleMix(suggestion.mix, total)); setEdited(false); }}>{t("generateMixReset")}</button>
                                        </div>
                                        <ul className="flex flex-col gap-1">
                                            {rows.map((ty) => (
                                                <li key={ty} className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-2 text-sm">
                                                    <span className="truncate">{labelOf(ty)}</span>
                                                    <span className="gen-mix-track" aria-hidden><span className="gen-mix-fill" style={{ width: `${Math.round((mix[ty] / top) * 100)}%` }} /></span>
                                                    <span className="flex items-center gap-1">
                                                        <button type="button" className="btn btn-secondary min-h-11 min-w-11 p-0 inline-flex items-center justify-center" aria-label={t("generateMixRemoveOne", { type: labelOf(ty) })} onClick={() => change(ty, -1)}><Minus size={16} aria-hidden /></button>
                                                        <span className="w-6 text-center tabular-nums">{mix[ty]}</span>
                                                        <button type="button" className="btn btn-secondary min-h-11 min-w-11 p-0 inline-flex items-center justify-center" aria-label={t("generateMixAddOne", { type: labelOf(ty) })} aria-describedby="mix-hint" disabled={freeN === 0} onClick={() => change(ty, 1)}><Plus size={16} aria-hidden /></button>
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                        {options.length > 0 && (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <label className="text-sm" htmlFor="mix-add">{t("generateMixAddType")}</label>
                                                <select id="mix-add" className="min-h-11 rounded-md border border-border bg-surface px-2" value={pick} onChange={(e) => setPick(e.target.value)}>
                                                    <option value="">…</option>
                                                    {options.map((ty) => <option key={ty} value={ty}>{labelOf(ty)}</option>)}
                                                </select>
                                                <button type="button" className="btn btn-secondary min-h-11" disabled={!pick || freeN === 0} aria-describedby="mix-hint"
                                                    onClick={() => { change(pick, 1); setPick(""); }}>{t("generateMixAdd")}</button>
                                            </div>
                                        )}
                                        <p id="mix-hint" className="text-sm text-muted">{freeN === 0 ? t("generateMixNeedRoom") : t("generateMixPlaceFree")}</p>
                                    </div>
                                </>
                            )
                        )}

                        {phase === "running" && job && (
                            <>
                                <GenerationProgress done={job.done} total={job.total} />
                                <p className="text-sm text-muted">{t("generateBackgroundNote")}</p>
                            </>
                        )}

                        {phase === "done" && job?.result && (
                            <div role="status" className="flex items-center gap-3">
                                <CheckCircle2 size={28} aria-hidden style={{ color: "var(--color-primary)" }} />
                                <p className="text-base font-medium">{t("generateSaved", { count: job.result.saved })}</p>
                            </div>
                        )}

                        {phase === "error" && (
                            <p role="alert" className="callout flex items-start gap-2"><AlertTriangle size={18} aria-hidden className="mt-0.5 shrink-0" /><span>{error}</span></p>
                        )}

                        <div className="flex flex-wrap justify-end gap-2">
                            {phase === "error" && <button type="button" className="btn btn-primary min-h-11" onClick={openDialog}>{t("generateRetry")}</button>}
                            {phase === "done" && job?.result && <button type="button" className="btn btn-secondary min-h-11" onClick={undo}>{t("generateUndo")}</button>}
                            {phase === "configure" && <button type="button" className="btn btn-primary min-h-11" disabled={suggestion.count === 0 || total < 1 || freeN > 0} onClick={start}>{t("generateStart")}</button>}
                            <button type="button" className="btn btn-secondary min-h-11" onClick={close}>{phase === "running" ? t("generateBackground") : t("generateClose")}</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
