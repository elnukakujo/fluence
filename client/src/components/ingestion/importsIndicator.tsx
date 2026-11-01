"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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

const RING_COLOR: Record<IndicatorState, string> = {
  running: "var(--color-accent)", attention: "var(--color-warning)", ready: "var(--color-success)", failed: "var(--color-danger)", idle: "var(--color-border)",
};

/** 3-segment ring hugging the button: finished steps filled, the current one filled by pages read (or pulsing while it waits). */
export function StepRing({ job, state, box }: { job: Pick<Job, "status" | "pages_done" | "pages_total">; state: IndicatorState; box: { w: number; h: number } }) {
  const step = stepOf(job);
  const frac = state === "ready" ? 1 : state === "running" && job.pages_total > 0 ? Math.min(1, job.pages_done / job.pages_total) : state === "running" ? 0 : 1;
  const pad = 4, sw = 3, w = box.w + pad * 2, h = box.h + pad * 2, r = h / 2;
  const seg = (i: number) => (i + 1 < step ? 1 : i + 1 === step ? frac : 0);
  const rect = { x: sw / 2, y: sw / 2, width: w - sw, height: h - sw, rx: r - sw / 2, fill: "none", pathLength: 300, strokeWidth: sw, strokeLinecap: "round" as const };
  return (
    <svg aria-hidden data-testid="step-ring" width={w} height={h} className="pointer-events-none absolute" style={{ left: -pad, top: -pad }}>
      <rect {...rect} stroke="var(--color-border)" strokeDasharray="94 6" />
      {[0, 1, 2].map((i) => {
        const f = seg(i);
        return f > 0 ? (
          <rect key={i} {...rect} stroke={RING_COLOR[state]} strokeDasharray={`${94 * f} 300`} strokeDashoffset={-i * 100}
            className={i + 1 === step && state !== "ready" && (state !== "running" || frac === 0) ? "animate-pulse" : undefined} data-step={i + 1} />
        ) : null;
      })}
    </svg>
  );
}

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
  const t = useTranslations("ingestion");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

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

  useLayoutEffect(() => {
    const el = btn.current;
    if (!el) return;
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [jobs.length]);

  if (jobs.length === 0) return null;
  const running = jobs.filter((j) => ACTIVE_STATUSES.includes(j.status) && !j.finished).length;
  const ready = jobs.filter((j) => j.status === "ready" && !j.finished).length;
  const count = running || ready;
  const state = indicatorState(jobs);
  const focus = focusJob(jobs);
  const stepText = focus ? t("importStepOf", { step: stepOf(focus) }) : "";

  return (
    <div className="relative" ref={box} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}>
      <button ref={btn} type="button" className="btn btn-secondary relative min-h-11 shrink-0" aria-expanded={open} aria-haspopup="true" aria-label={`${t("importsAriaLabel", { state: t(`indicatorState_${state}`) })}${focus ? `, ${stepText}` : ""}`} title={focus ? stepText : undefined} onClick={() => { if (!open) load(); setOpen((o) => !o); }}>
        {focus && size.w > 0 && <StepRing job={focus} state={state} box={size} />}
        <span className="inline-flex items-center gap-2"><StateIcon state={state} /><span className="max-md:hidden">{t("importsLabel")}</span></span>{count > 0 && <span className="badge ml-1 md:ml-2" aria-label={running ? t("runningCount", { count: running }) : t("readyCount", { count: ready })}>{count}</span>}
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
