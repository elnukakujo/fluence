"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Sparkles, X } from "lucide-react";
import { getGeneration, startGeneration, suggestGeneration, undoGenerationBatch, type GenerationJob } from "@/api/exercise";
import { EXERCISE_TYPE_KEY } from "@/i18n/exerciseTypes";
import GenerationReview from "./generationReview";
import GenerationProgress from "./generationProgress";
import NumberField from "@/components/ui/input/numberField";

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
    const dialogRef = useRef<HTMLDivElement>(null);
    const tRef = useRef(t); tRef.current = t;      // the polling effect must not restart whenever the translator changes identity

    useEffect(() => { if (phase === "configure") dialogRef.current?.querySelector<HTMLInputElement>("input[type=number]")?.focus(); }, [phase]);

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
                if (next.state === "failed") { setError(tRef.current("generateFailed", { error: next.error ?? "" })); return setPhase("error"); }
            } catch (e) {
                if (stopped) return;
                setError(e instanceof Error && e.message === "lost" ? tRef.current("generateLost") : tRef.current("generateFailed", { error: String(e) }));
                return setPhase("error");
            }
            timer = setTimeout(poll, POLL_MS);
        };
        timer = setTimeout(poll, POLL_MS);
        return () => { stopped = true; clearTimeout(timer); };
    }, [phase, jobId]);

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

    const mix = Object.entries(suggestion.mix).sort((a, b) => b[1] - a[1]);
    const top = mix[0]?.[1] ?? 1;
    const review = phase === "done" && (job?.result?.flagged.length ?? 0) > 0;   // step 2 replaces the dialog
    return (
        <>
            <button type="button" className="btn btn-secondary min-h-11 inline-flex items-center gap-2" onClick={openDialog}>
                <Sparkles size={16} aria-hidden />{t("generateButton")}
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
                                            <NumberField value={count === "" ? "" : Number(count)} onChange={(v) => setCount(String(v))} min={1} max={MAX} ariaLabel={t("generateCount")} />
                                            <span className="text-sm text-muted">{t("generateSuggested", { count: suggestion.count, max: MAX })}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="mb-2 text-sm font-medium">{t("generateMix")}</p>
                                        <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                                            {mix.map(([type, n]) => (
                                                <li key={type} className="grid grid-cols-[minmax(0,7rem)_1fr_1.5rem] items-center gap-2 text-sm">
                                                    <span className="truncate">{EXERCISE_TYPE_KEY[type] ? t(EXERCISE_TYPE_KEY[type]) : type}</span>
                                                    <span className="gen-mix-track" aria-hidden><span className="gen-mix-fill" style={{ width: `${Math.round((n / top) * 100)}%` }} /></span>
                                                    <span className="text-right tabular-nums">{n}</span>
                                                </li>
                                            ))}
                                        </ul>
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
                            {phase === "configure" && <button type="button" className="btn btn-primary min-h-11" disabled={suggestion.count === 0} onClick={start}>{t("generateStart")}</button>}
                            <button type="button" className="btn btn-secondary min-h-11" onClick={close}>{phase === "running" ? t("generateBackground") : t("generateClose")}</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
