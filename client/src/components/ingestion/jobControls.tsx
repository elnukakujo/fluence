"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LoaderCircle, Pause, Play, Square } from "lucide-react";
import { pauseJob, resumeJob, stopJob } from "@/api/ingestion";

const BTN = "btn btn-secondary inline-flex min-h-11 min-w-11 items-center justify-center !p-0";

/** Pause / play (one button, swaps with the state) and stop for a running import. Stop quits before the next page, so no more tokens are spent. */
export default function JobControls({ jobId, paused = false, onStopped }: { jobId: string; paused?: boolean; onStopped?: () => void }) {
  const t = useTranslations("ingestion");
  const [isPaused, setPaused] = useState(paused);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<void>, done: () => void, failed: () => void) => {
    setBusy(true);
    setError(null);
    try { await action(); done(); } catch (e) { setError(e instanceof Error ? e.message : t("couldNotStop")); failed(); }
    setBusy(false);
  };
  const toggle = isPaused ? t("resumeImport") : t("pauseImport");
  return (
    <>
      <button type="button" className={BTN} disabled={busy} aria-label={toggle} title={toggle} aria-pressed={isPaused}
        onClick={() => run(() => (isPaused ? resumeJob(jobId) : pauseJob(jobId)), () => setPaused(!isPaused), () => undefined)}>
        {isPaused ? <Play size={16} aria-hidden fill="currentColor" /> : <Pause size={16} aria-hidden fill="currentColor" />}
      </button>
      <button type="button" className={BTN} disabled={busy} aria-label={busy ? t("stopping") : t("stopImport")} title={busy ? t("stopping") : t("stopImport")}
        onClick={() => run(() => stopJob(jobId), () => onStopped?.(), () => undefined)}>
        {busy ? <LoaderCircle size={18} aria-hidden className="animate-spin motion-reduce:animate-none" /> : <Square size={16} aria-hidden fill="currentColor" />}
      </button>
      {error && <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>✗ {error}</p>}
    </>
  );
}
