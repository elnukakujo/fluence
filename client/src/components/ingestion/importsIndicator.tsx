"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import StepProgress from "./stepProgress";
import { ACTIVE_STATUSES, INGESTION_CHANGED, type Job, deleteJob, listJobs } from "@/api/ingestion";

// Poll fast only while a job is progressing by itself; otherwise nothing changes until the user acts
// (and our own actions / tab focus refresh immediately).
export const POLL_ACTIVE_MS = 5000;
export const POLL_IDLE_MS = 60000;
const SELF_PROGRESSING = ["queued", "parsing", "extracting"];

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

/** The import the button reports on: same priority as the state (running > needs you > ready > failed), newest first. */
export function focusJob<T extends Pick<Job, "status" | "finished">>(all: T[]): T | undefined {
  const jobs = all.filter((j) => !j.finished);
  for (const group of [["queued", "parsing", "extracting"], ["pages", "structure"], ["ready"], ["failed"]]) {
    const hit = jobs.find((j) => group.includes(j.status));
    if (hit) return hit;
  }
  return undefined;
}

export type RingStatus = "running" | "attention" | "failed" | "done";

/** Where the two arcs of the ring end, in 0..300 path units (100 per import step).
 *  `done` = steps already finished (green); `current` = the step in progress, drawn in the job's status colour. */
export function ringGeometry(step: 1 | 2 | 3, state: IndicatorState, read: number): { done: number; current: number; status: RingStatus } {
  if (state === "ready") return { done: 300, current: 0, status: "done" };
  const done = (step - 1) * 100;
  if (state === "running") return { done, current: Math.max(read, 0.04) * 100, status: "running" };   // fills with pages read
  if (state === "attention") return { done, current: 100, status: "attention" };                       // the step is waiting for the user
  return { done, current: 100, status: "failed" };
}

const RING_COLOR: Record<RingStatus, string> = {
  done: "var(--color-success)", running: "var(--color-accent)", attention: "var(--color-warning)", failed: "var(--color-danger)",
};

/** A thin continuous ring hugging the 44px button, 3 steps = 3 thirds (notches mark them).
 *  Green = steps finished; the next arc continues in the status colour (rust running, amber waiting for you, red failed).
 *  The arc length animates smoothly; "waiting" breathes gently. Colour is never the only cue: icon, tooltip and
 *  accessible name carry the state and step too. */
export function StepRing({ job, state }: { job: Pick<Job, "status" | "pages_done" | "pages_total">; state: IndicatorState }) {
  const read = job.pages_total > 0 ? Math.min(1, job.pages_done / job.pages_total) : 0;
  const g = ringGeometry(stepOf(job), state, read);
  const arc = { cx: 26, cy: 26, r: 24.5, fill: "none", pathLength: 300, strokeWidth: 2.5, transform: "rotate(-90 26 26)" };
  const grow = { transition: "stroke-dasharray 600ms cubic-bezier(.4,0,.2,1)" };
  return (
    <svg aria-hidden data-testid="step-ring" viewBox="0 0 52 52" width={52} height={52}
      className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${g.status === "done" ? "drop-shadow-[0_0_3px_color-mix(in_srgb,var(--color-success)_55%,transparent)]" : ""}`}>
      <circle {...arc} stroke="var(--color-border)" opacity={0.7} />
      {g.done > 0 && <circle {...arc} stroke={RING_COLOR.done} strokeDasharray={`${g.done} 300`} style={grow} data-arc="done" />}
      {g.current > 0 && (
        <circle {...arc} stroke={RING_COLOR[g.status]} strokeDasharray={`${g.current} 300`} strokeDashoffset={-g.done} style={grow}
          className={g.status === "attention" ? "animate-pulse motion-reduce:animate-none" : undefined} data-arc="current" data-status={g.status} />
      )}
      {[0, 120, 240].map((deg) => (
        <line key={deg} x1={26} y1={0.4} x2={26} y2={3.8} stroke="var(--color-surface)" strokeWidth={1.6} transform={`rotate(${deg} 26 26)`} />
      ))}
    </svg>
  );
}

function StateIcon({ state }: { state: IndicatorState }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.25, strokeLinecap: "round" as const, "aria-hidden": true };
  if (state === "running") return <svg {...common} className="animate-spin motion-reduce:animate-none" data-testid="spinner"><path d="M12 3a9 9 0 1 0 9 9" /></svg>;
  if (state === "ready") return <svg {...common}><path d="M5 13l4 4L19 7" /></svg>;
  if (state === "failed") return <svg {...common}><path d="M12 7v6M12 17h.01" /><circle cx="12" cy="12" r="9" /></svg>;
  if (state === "attention") return <svg {...common}><path d="M12 8v5M12 17h.01" /><path d="M4 20h16L12 4z" /></svg>;
  return <svg {...common}><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>;
}

// Scans take minutes, so imports outlive the page that started them: this is the way back.
export default function ImportsIndicator() {
  const t = useTranslations("ingestion");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const busy = useRef(false); // true while a job is progressing by itself

  const load = useCallback(async () => {
    try {
      const list = await listJobs();
      busy.current = list.some((j) => SELF_PROGRESSING.includes(j.status) && !j.finished);
      setJobs(list);
    } catch { /* the bar must never break the page */ }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let alive = true;
    const loop = async () => {
      if (!document.hidden) await load();
      if (alive) timer = setTimeout(loop, busy.current ? POLL_ACTIVE_MS : POLL_IDLE_MS);
    };
    const refreshNow = () => {
      if (document.hidden) return;
      clearTimeout(timer);
      loop();
    };
    loop();
    document.addEventListener("visibilitychange", refreshNow);
    window.addEventListener(INGESTION_CHANGED, refreshNow);
    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", refreshNow);
      window.removeEventListener(INGESTION_CHANGED, refreshNow);
    };
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
  const focus = focusJob(jobs);
  const stepText = focus ? t("importStepOf", { step: stepOf(focus) }) : "";
  const countText = running ? t("runningCount", { count: running }) : ready ? t("readyCount", { count: ready }) : "";
  const label = [t("importsAriaLabel", { state: t(`indicatorState_${state}`) }), stepText, countText].filter(Boolean).join(", ");

  return (
    <div className="relative" ref={box} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}>
      <button
        type="button"
        className="btn btn-secondary relative size-11 shrink-0 !p-0"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={label}
        title={label}
        onClick={() => { if (!open) load(); setOpen((o) => !o); }}
      >
        {focus && <StepRing job={focus} state={state} />}
        <StateIcon state={state} />
        {count > 0 && (
          <span aria-hidden className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface">
            {count}
          </span>
        )}
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
                <StepProgress step={stepOf(j)} second={j.lesson_id ? t("chooseThePages") : t("chooseTheLessons")} />
                <span className="opacity-70">{j.finished ? t("addedNothingLeft") : t(`jobStatus_${j.status}`)}{j.status === "extracting" && j.pages_total > 0 ? ` ${j.pages_done}/${j.pages_total}` : ""}</span>
              </div>
              {!ACTIVE_STATUSES.includes(j.status) && (
                <button type="button" className="btn btn-secondary" aria-label={t("removeImport", { filename: j.filename })}
                  onClick={async () => { await deleteJob(j.id).catch(() => undefined); load(); }}>×</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
