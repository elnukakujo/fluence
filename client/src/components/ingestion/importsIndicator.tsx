"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import StepProgress from "./stepProgress";
import { ACTIVE_STATUSES, type Job, deleteJob, listJobs } from "@/api/ingestion";

const LABEL: Record<Job["status"], string> = {
  queued: "Waiting", parsing: "Reading…", pages: "Choose content types", structure: "Choose the lessons", extracting: "Finding the content…", ready: "Ready to review", failed: "Failed",
};

export type IndicatorState = "running" | "attention" | "ready" | "failed" | "idle";

/** What the Imports button shows: running beats needs-you beats ready beats failed. */
export function indicatorState(all: Pick<Job, "status" | "finished">[]): IndicatorState {
  const jobs = all.filter((j) => !j.finished);
  const has = (...s: Job["status"][]) => jobs.some((j) => s.includes(j.status));
  return has("queued", "parsing", "extracting") ? "running" : has("pages", "structure") ? "attention" : has("ready") ? "ready" : has("failed") ? "failed" : "idle";
}

/** Where an import is in the three steps: 1 upload/reading, 2 pages or lessons, 3 extraction and review. */
export function stepOf(j: Pick<Job, "status">): 1 | 2 | 3 {
  return j.status === "pages" || j.status === "structure" ? 2 : j.status === "extracting" || j.status === "ready" ? 3 : 1;
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
  const box = useRef<HTMLDivElement>(null);

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

  // the menu closes when the user clicks elsewhere, tabs away or presses Escape
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (jobs.length === 0) return null;
  const running = jobs.filter((j) => ACTIVE_STATUSES.includes(j.status) && !j.finished).length;
  const ready = jobs.filter((j) => j.status === "ready" && !j.finished).length;
  const count = running || ready;
  const state = indicatorState(jobs);

  return (
    <div className="relative" ref={box} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}>
      <button type="button" className="btn btn-secondary" aria-expanded={open} aria-haspopup="true" aria-label={`Imports: ${STATE_TEXT[state]}`} onClick={() => setOpen((o) => !o)}>
        <span className="inline-flex items-center gap-2"><StateIcon state={state} />Imports</span>{count > 0 && <span className="badge ml-2" aria-label={running ? `${running} running` : `${ready} ready`}>{count}</span>}
      </button>
      {open && (
        <ul className="card absolute left-0 top-full z-40 mt-2 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 text-sm shadow-lg sm:left-auto sm:right-0">
          {jobs.slice(0, 8).map((j) => (
            <li key={j.id} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Link className="link block truncate" onClick={() => setOpen(false)}
                  href={j.lesson_id ? `/languages/${j.language_id}/lesson/${j.lesson_id}/import?job=${j.id}` : `/languages/${j.language_id}/import?job=${j.id}`}>
                  {j.filename}
                </Link>
                <StepProgress step={stepOf(j)} second={j.lesson_id ? "Choose the pages" : "Choose the lessons"} />
                <span className="opacity-70">{j.finished ? "Added - nothing left to do" : LABEL[j.status]}{j.status === "extracting" && j.pages_total > 0 ? ` ${j.pages_done}/${j.pages_total}` : ""}</span>
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
