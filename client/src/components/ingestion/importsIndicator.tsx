"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ACTIVE_STATUSES, type Job, deleteJob, listJobs } from "@/api/ingestion";

const LABEL: Record<Job["status"], string> = {
  queued: "Waiting", parsing: "Reading…", pages: "Choose content types", structure: "Choose the lessons", extracting: "Finding the content…", ready: "Ready to review", failed: "Failed",
};

export type IndicatorState = "running" | "attention" | "ready" | "failed" | "idle";

/** What the Imports button shows: running beats needs-you beats ready beats failed. */
export function indicatorState(jobs: Pick<Job, "status">[]): IndicatorState {
  const has = (...s: Job["status"][]) => jobs.some((j) => s.includes(j.status));
  return has("queued", "parsing", "extracting") ? "running" : has("pages", "structure") ? "attention" : has("ready") ? "ready" : has("failed") ? "failed" : "idle";
}

const STATE_TEXT: Record<IndicatorState, string> = {
  running: "import running", attention: "import waiting for you", ready: "import ready to review", failed: "import failed", idle: "no active import",
};

function StateIcon({ state }: { state: IndicatorState }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round" as const, "aria-hidden": true };
  if (state === "running") return <svg {...common} className="animate-spin" data-testid="spinner"><path d="M12 3a9 9 0 1 0 9 9" /></svg>;
  if (state === "ready") return <svg {...common}><path d="M5 13l4 4L19 7" /></svg>;
  if (state === "failed") return <svg {...common}><path d="M12 7v6M12 17h.01" /><circle cx="12" cy="12" r="9" /></svg>;
  if (state === "attention") return <svg {...common}><path d="M12 8v5M12 17h.01" /><path d="M4 20h16L12 4z" /></svg>;
  return <svg {...common}><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>;
}

// Scans take minutes, so imports outlive the page that started them: this is the way back.
export default function ImportsIndicator() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try { setJobs(await listJobs()); } catch { /* the bar must never break the page */ }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let alive = true;
    const loop = async () => {
      if (!document.hidden) await load();
      if (alive) timer = setTimeout(loop, 5000);
    };
    loop();
    return () => { alive = false; clearTimeout(timer); };
  }, [load]);

  if (jobs.length === 0) return null;
  const running = jobs.filter((j) => ACTIVE_STATUSES.includes(j.status)).length;
  const ready = jobs.filter((j) => j.status === "ready").length;
  const count = running || ready;
  const state = indicatorState(jobs);

  return (
    <div className="relative">
      <button type="button" className="btn btn-secondary" aria-expanded={open} aria-haspopup="true" aria-label={`Imports: ${STATE_TEXT[state]}`} onClick={() => setOpen((o) => !o)}>
        <span className="inline-flex items-center gap-2"><StateIcon state={state} />Imports</span>{count > 0 && <span className="badge ml-2" aria-label={running ? `${running} running` : `${ready} ready`}>{count}</span>}
      </button>
      {open && (
        <ul className="card absolute right-0 top-full z-40 mt-2 flex w-80 max-w-[90vw] flex-col gap-2 text-sm shadow-lg">
          {jobs.slice(0, 8).map((j) => (
            <li key={j.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <Link className="link block truncate" onClick={() => setOpen(false)}
                  href={j.lesson_id ? `/languages/${j.language_id}/lesson/${j.lesson_id}/import?job=${j.id}` : `/languages/${j.language_id}/import?job=${j.id}`}>
                  {j.filename}
                </Link>
                <span className="opacity-70">{LABEL[j.status]}{j.status === "extracting" && j.pages_total > 0 ? ` ${j.pages_done}/${j.pages_total}` : ""}</span>
              </div>
              {!ACTIVE_STATUSES.includes(j.status) && (
                <button type="button" className="btn btn-secondary" aria-label={`Remove import ${j.filename}`}
                  onClick={async () => { await deleteJob(j.id).catch(() => undefined); load(); }}>×</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
