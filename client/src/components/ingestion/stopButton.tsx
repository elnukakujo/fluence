"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LoaderCircle, Square } from "lucide-react";
import { stopJob } from "@/api/ingestion";

/** Stops a running import; the worker quits before its next page, so no more tokens are spent. */
export default function StopButton({ jobId, onStopped }: { jobId: string; onStopped?: () => void }) {
  const t = useTranslations("ingestion");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" className="btn btn-secondary inline-flex min-h-11 min-w-11 items-center justify-center !p-0" disabled={busy}
        aria-label={busy ? t("stopping") : t("stopImport")} title={busy ? t("stopping") : t("stopImport")} onClick={async () => {
        setBusy(true);
        setError(null);
        try { await stopJob(jobId); onStopped?.(); } catch (e) { setError(e instanceof Error ? e.message : t("couldNotStop")); setBusy(false); }
      }}>
        {busy ? <LoaderCircle size={18} aria-hidden className="animate-spin motion-reduce:animate-none" /> : <Square size={16} aria-hidden fill="currentColor" />}
      </button>
      {error && <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>✗ {error}</p>}
    </>
  );
}
