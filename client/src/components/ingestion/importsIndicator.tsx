"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ACTIVE_STATUSES, type Job, deleteJob, listJobs } from "@/api/ingestion";

const LABEL: Record<Job["status"], string> = {
  queued: "Waiting", parsing: "Reading…", extracting: "Finding vocabulary…", ready: "Ready to review", failed: "Failed",
};

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

  return (
    <div className="relative">
      <button type="button" className="btn btn-secondary" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        Imports{count > 0 && <span className="badge ml-2" aria-label={running ? `${running} running` : `${ready} ready`}>{count}</span>}
      </button>
      {open && (
        <ul className="card absolute right-0 top-full z-40 mt-2 flex w-80 max-w-[90vw] flex-col gap-2 text-sm shadow-lg">
          {jobs.slice(0, 8).map((j) => (
            <li key={j.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                {j.lesson_id ? (
                  <Link className="link block truncate" href={`/languages/${j.language_id}/lesson/${j.lesson_id}/import?job=${j.id}`} onClick={() => setOpen(false)}>
                    {j.filename}
                  </Link>
                ) : <span className="block truncate">{j.filename}</span>}
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
