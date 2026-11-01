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

export type StepStatus = "done" | "running" | "attention" | "failed" | "todo";

/** Each of the 3 import steps has its own status: earlier steps are done, the current one follows the job state, later ones are todo. */
export function stepStatuses(step: 1 | 2 | 3, state: IndicatorState): StepStatus[] {
  return [1, 2, 3].map((i): StepStatus => {
    if (i < step) return "done";
    if (i > step) return "todo";
    return state === "ready" ? "done" : state === "running" ? "running" : state === "attention" ? "attention" : state === "failed" ? "failed" : "todo";
  });
}

const STEP_COLOR: Record<StepStatus, string> = {
  done: "var(--color-success)", running: "var(--color-accent)", attention: "var(--color-warning)", failed: "var(--color-danger)", todo: "var(--color-border)",
};

const SEG = 86; // visible length of one segment, out of 100 (the rest is the gap between segments)

/** Circular 3-segment ring around the 44px button: one arc per import step, coloured by that step's status.
 *  The running step fills with pages read; a step that waits for the user pulses. Colour is never the only signal:
 *  the icon, tooltip and accessible name carry the state too. */
export function StepRing({ job, state }: { job: Pick<Job, "status" | "pages_done" | "pages_total">; state: IndicatorState }) {
  const step = stepOf(job);
  const statuses = stepStatuses(step, state);
  const read = job.pages_total > 0 ? Math.min(1, job.pages_done / job.pages_total) : 0;
  const circle = { cx: 26, cy: 26, r: 24.5, fill: "none", pathLength: 300, strokeWidth: 3, strokeLinecap: "round" as const, transform: "rotate(-90 26 26)" };
  return (
    <svg aria-hidden data-testid="step-ring" viewBox="0 0 52 52" width={52} height={52} className="pointer-events-none absolute -left-1 -top-1">
      <circle {...circle} stroke="var(--color-border)" strokeDasharray={`${SEG} ${100 - SEG}`} />
      {statuses.map((st, i) => {
        if (st === "todo") return null;
        const f = st === "running" ? Math.max(read, 0.04) : 1;
        return (
          <circle key={i} {...circle} stroke={STEP_COLOR[st]} strokeDasharray={`${SEG * f} 300`} strokeDashoffset={-i * 100}
            className={st === "attention" || (st === "running" && read === 0) ? "animate-pulse motion-reduce:animate-none" : undefined}
            data-step={i + 1} data-status={st} />
        );
      })}
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
