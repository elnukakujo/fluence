"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { getGeneration, startGeneration, suggestGeneration, undoGenerationBatch, type GenerationJob } from "@/api/exercise";
import { EXERCISE_TYPE_KEY } from "@/i18n/exerciseTypes";

const MAX = 60;           // same cap as the server (GEN_MAX)
const POLL_MS = 2000;
type Phase = "closed" | "loading" | "configure" | "running" | "done" | "error";

/** "Generate exercises" button + dialog: pick how many, watch the progress, see what was saved and undo the batch. */
export default function GenerateDialog({ lessonId }: { lessonId: string }) {
    const t = useTranslations("exercises");
    const router = useRouter();
    const [phase, setPhase] = useState<Phase>("closed");
    const [suggestion, setSuggestion] = useState<{ count: number; mix: Record<string, number> }>({ count: 0, mix: {} });
    const [count, setCount] = useState("");
    const [job, setJob] = useState<GenerationJob | null>(null);
    const [jobId, setJobId] = useState<string | null>(null);
    const [error, setError] = useState<string>("");
    const countRef = useRef<HTMLInputElement>(null);

    useEffect(() => { if (phase === "configure") countRef.current?.focus(); }, [phase]);

    useEffect(() => {
        if (phase !== "running" || !jobId) return;
        let stopped = false;
        let timer: ReturnType<typeof setTimeout>;
        const poll = async () => {
            try {
                const next = await getGeneration(jobId);
                if (stopped) return;
                setJob(next);
                if (next.state === "done") return setPhase("done");
                if (next.state === "failed") { setError(t("generateFailed", { error: next.error ?? "" })); return setPhase("error"); }
            } catch (e) {
                if (stopped) return;
                setError(e instanceof Error && e.message === "lost" ? t("generateLost") : t("generateFailed", { error: String(e) }));
                return setPhase("error");
            }
            timer = setTimeout(poll, POLL_MS);
        };
        timer = setTimeout(poll, POLL_MS);
        return () => { stopped = true; clearTimeout(timer); };
    }, [phase, jobId, t]);

    const openDialog = async () => {
        setPhase("loading");
        setError("");
        try {
            const s = await suggestGeneration(lessonId);
            setSuggestion(s);
            setCount(String(s.count));
            setPhase("configure");
        } catch (e) {
            setError(t("generateFailed", { error: String(e) }));
            setPhase("error");
        }
    };

    const close = () => {
        if (phase === "done") router.refresh();
        setPhase("closed");
        setJob(null);
        setJobId(null);
    };

    const start = async () => {
        const n = Math.min(MAX, Math.max(1, parseInt(count, 10) || 1));
        try {
            setJobId(await startGeneration(lessonId, n));
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

    const mix = Object.entries(suggestion.mix);
    return (
        <>
            <button type="button" className="btn btn-secondary min-h-11 inline-flex items-center gap-2" onClick={openDialog}>
                <Sparkles size={16} aria-hidden />{t("generateButton")}
            </button>
            {phase !== "closed" && (
                <div className="dialog-backdrop" onKeyDown={(e) => { if (e.key === "Escape") close(); }}>
                    <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="generate-title">
                        <h2 id="generate-title" className="text-lg font-semibold">{t("generateTitle")}</h2>

                        {phase === "loading" && <p role="status">{t("generateLoading")}</p>}

                        {phase === "configure" && (
                            suggestion.count === 0 ? <p>{t("generateNone")}</p> : (
                                <>
                                    <label className="flex flex-col gap-1 text-sm">
                                        {t("generateCount")}
                                        <input ref={countRef} className="input" type="number" min={1} max={MAX} value={count} onChange={(e) => setCount(e.target.value)} />
                                    </label>
                                    <div>
                                        <p className="text-sm font-medium">{t("generateMix")}</p>
                                        <ul className="flex flex-wrap gap-2 text-sm">
                                            {mix.map(([type, n]) => <li key={type} className="badge">{EXERCISE_TYPE_KEY[type] ? t(EXERCISE_TYPE_KEY[type]) : type}: {n}</li>)}
                                        </ul>
                                    </div>
                                </>
                            )
                        )}

                        {phase === "running" && job && (
                            <div role="status" aria-live="polite">
                                <p>{t("generateRunning", { done: job.done, total: job.total })}</p>
                                <progress className="w-full" max={Math.max(job.total, 1)} value={job.done} aria-label={t("generateTitle")} />
                            </div>
                        )}

                        {phase === "done" && job?.result && (
                            <div role="status" className="flex flex-col gap-1">
                                <p>{t("generateSaved", { count: job.result.saved })}</p>
                                {job.result.flagged.length > 0 && <p>{t("generateFlagged", { count: job.result.flagged.length })}</p>}
                            </div>
                        )}

                        {phase === "error" && <p role="alert" className="text-red-600">{error}</p>}

                        <div className="flex flex-wrap justify-end gap-2">
                            {phase === "done" && job?.result && <button type="button" className="btn btn-secondary min-h-11" onClick={undo}>{t("generateUndo")}</button>}
                            {phase === "configure" && <button type="button" className="btn btn-primary min-h-11" disabled={suggestion.count === 0} onClick={start}>{t("generateStart")}</button>}
                            <button type="button" className="btn btn-secondary min-h-11" onClick={close}>{t("generateClose")}</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
