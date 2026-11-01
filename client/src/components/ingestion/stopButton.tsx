"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { stopJob } from "@/api/ingestion";

/** Stops a running import; the worker quits before its next page, so no more tokens are spent. */
export default function StopButton({ jobId, onStopped }: { jobId: string; onStopped?: () => void }) {
  const t = useTranslations("ingestion");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={async () => {
        setBusy(true);
        setError(null);
        try { await stopJob(jobId); onStopped?.(); } catch (e) { setError(e instanceof Error ? e.message : t("couldNotStop")); setBusy(false); }
      }}>{busy ? t("stopping") : t("stopImport")}</button>
      {error && <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>✗ {error}</p>}
    </>
  );
}
