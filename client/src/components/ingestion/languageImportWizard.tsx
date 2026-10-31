"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProgressBar from "@/components/ui/progressBar";
import {
  ACTIVE_STATUSES, type Job, type LessonProgress, type Structure, acceptLesson, confirmStructure, deleteJob, getJob,
  flattenElements, getLanguageCandidates, getStructure,
} from "@/api/ingestion";
import {
  type Draft, addDraft, draftsFromProposal, estimateCalls, removeDraft, toConfirmPayload, validateDrafts,
} from "@/lib/ingestion/structure";
import { LANGUAGE_to_ISO639_2T } from "@/utils/language_iso639";
import { STATUS_TEXT, UploadStep } from "./importWizard";
import ReviewPanel from "./reviewPanel";
import { PageKindsWithViewer } from "./pageKinds";

type Props = { languageId: string; languageName: string; settingsHref: string };

// Whole-book import: upload -> (parse) -> choose the lessons -> per-lesson extraction -> review and add each lesson.
export default function LanguageImportWizard(props: Props) {
  const jobId = useSearchParams().get("job");
  const base = `/languages/${props.languageId}/import`;
  const languageCode = LANGUAGE_to_ISO639_2T[props.languageName] || "zho";
  return jobId ? <JobView key={jobId} jobId={jobId} base={base} {...props} /> : (
    <UploadStep languageId={props.languageId} heading={`Import lessons into "${props.languageName}"`}
      settingsHref={props.settingsHref} base={base} cancelHref={`/languages/${props.languageId}`}
      languageCode={languageCode} showLevel={true} />
  );
}

function JobView({ jobId, languageId, languageName, settingsHref, base }: Props & { jobId: string; base: string }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0); // bump to restart polling after the user confirms the lessons

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const j = await getJob(jobId);
        if (!alive) return;
        setJob(j);
        if (ACTIVE_STATUSES.includes(j.status)) timer = setTimeout(tick, 2000);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Could not load this import");
      }
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [jobId, nonce]);

  const startOver = async () => {
    await deleteJob(jobId).catch(() => undefined);
    router.replace(base);
  };

  if (error) return <div role="alert" className="card max-w-2xl">✗ {error} <Link href={base} className="link">Start a new import</Link></div>;
  if (!job) return <div className="card max-w-2xl" aria-busy="true">Loading…</div>;

  if (job.status === "queued" || job.status === "parsing") {
    return (
      <div className="card flex max-w-2xl flex-col gap-3">
        <h2>{job.filename}</h2>
        <p aria-live="polite">{STATUS_TEXT[job.status]}</p>
        <p className="text-sm opacity-70">
          Reading a long scan takes a few minutes. You can leave this page: the import is listed under "Imports" in the top bar.
        </p>
      </div>
    );
  }
  if (job.status === "failed") {
    return (
      <div role="alert" className="card flex max-w-2xl flex-col gap-3">
        <h2>The import failed</h2>
        <p>{job.error}</p>
        {/endpoint/i.test(job.error ?? "") && <Link href={settingsHref} className="link">Go to Settings</Link>}
        <div className="btn-row"><button className="btn btn-primary" onClick={startOver}>Try another document</button></div>
      </div>
    );
  }
  if (job.status === "structure") {
    return <StructureStep job={job} onConfirmed={() => { setJob({ ...job, status: "extracting" }); setNonce((n) => n + 1); }} />;
  }
  return <LessonsReview job={job} languageId={languageId} languageName={languageName} />;
}

function StructureStep({ job, onConfirmed }: { job: Job; onConfirmed: () => void }) {
  const [structure, setStructure] = useState<Structure | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pageKinds, setPageKinds] = useState<Record<number, string[]>>({});

  useEffect(() => {
    getStructure(job.id).then((s) => {
      setStructure(s);
      setDrafts(draftsFromProposal(s.lessons));
      if (s.page_kinds) {
        const kindsByNumber: Record<number, string[]> = {};
        for (const [key, kinds] of Object.entries(s.page_kinds)) {
          kindsByNumber[parseInt(key, 10)] = kinds;
        }
        setPageKinds(kindsByNumber);
      }
    }).catch((e) => setError(e.message));
  }, [job.id]);

  if (error && !structure) return <div role="alert" className="card max-w-2xl">✗ {error}</div>;
  if (!structure) return <div className="card max-w-2xl" aria-busy="true">Loading the lessons…</div>;

  const problem = validateDrafts(drafts, structure.first_page, structure.last_page);
  const calls = estimateCalls(drafts);
  const set = (i: number, change: Partial<Draft>) => setDrafts((ds) => ds.map((d, n) => (n === i ? { ...d, ...change } : d)));
  const included = drafts.filter((d) => d.include).length;

  const confirm = async () => {
    setSaving(true);
    setError(null);
    try {
      const pageKindsStr: Record<string, string[]> = {};
      for (const [key, kinds] of Object.entries(pageKinds)) {
        pageKindsStr[key] = kinds;
      }
      await confirmStructure(job.id, toConfirmPayload(drafts), pageKindsStr);
      onConfirmed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the extraction");
      setSaving(false);
    }
  };

  return (
    <section className="flex max-w-4xl flex-col gap-4">
      <header className="card flex flex-col gap-2">
        <h2>Which lessons are in {job.filename}?</h2>
        <p className="text-sm opacity-70">
          We looked at the top of every page to guess where each lesson starts. Check the titles and page numbers, rename,
          untick or add lessons, then continue. Pages {structure.first_page}-{structure.last_page} were read; pages outside a lesson are skipped.
        </p>
        {structure.warnings.length > 0 && (
          <ul className="list-disc pl-5 text-sm">{structure.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        )}
      </header>

      <ul className="flex flex-col gap-2">
        {drafts.map((d, i) => {
          const startPage = parseInt(d.start, 10);
          const endPage = parseInt(d.end, 10);
          const lessonPages = Array.from(
            { length: endPage - startPage + 1 },
            (_, idx) => startPage + idx
          );
          return (
            <li key={i} className="card flex flex-col gap-2">
              <div className="flex flex-wrap items-end gap-3">
                <input type="checkbox" className="mb-3" checked={d.include} aria-label={`Include lesson ${i + 1}`} onChange={(e) => set(i, { include: e.target.checked })} />
                <label className="flex min-w-48 flex-[3] flex-col gap-1">
                  <span className="text-xs opacity-60">Title</span>
                  <input className="input" value={d.title} onChange={(e) => set(i, { title: e.target.value })} />
                </label>
                <label className="flex w-24 flex-col gap-1">
                  <span className="text-xs opacity-60">First page</span>
                  <input className="input" inputMode="numeric" value={d.start} onChange={(e) => set(i, { start: e.target.value })} />
                </label>
                <label className="flex w-24 flex-col gap-1">
                  <span className="text-xs opacity-60">Last page</span>
                  <input className="input" inputMode="numeric" value={d.end} onChange={(e) => set(i, { end: e.target.value })} />
                </label>
                {d.verified !== null && (
                  <span className="badge mb-2" title={d.verified ? "This title appears on its first page" : "Not found on its first page"}>
                    {d.verified ? "✓ Found on the page" : "⚠ Check this"}
                  </span>
                )}
                <button type="button" className="btn btn-secondary mb-1" aria-label={`Remove lesson ${i + 1}`} onClick={() => setDrafts((ds) => removeDraft(ds, i))}>×</button>
              </div>
              {d.note && <p className="text-sm">⚠ {d.note}</p>}
              {d.include && (
                <details className="text-sm">
                  <summary className="cursor-pointer opacity-70">Confirm kinds on pages {startPage}-{endPage}</summary>
                  <div className="mt-2 pl-4">
                    <PageKindsWithViewer
                      jobId={job.id}
                      pages={lessonPages}
                      value={pageKinds as any}
                      onChange={(newPageKinds) => setPageKinds(newPageKinds as any)}
                    />
                  </div>
                </details>
              )}
            </li>
          );
        })}
      </ul>

      <div className="card flex flex-col gap-2">
        <p aria-live="polite">
          {included} lesson{included === 1 ? "" : "s"} · up to {calls} model call{calls === 1 ? "" : "s"} (one per page; pages without text cost nothing). The calls use your own text endpoint.
        </p>
        {(problem || error) && <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>✗ {error ?? problem}</p>}
        <div className="btn-row">
          <button type="button" className="btn btn-secondary" onClick={() => setDrafts((ds) => addDraft(ds, structure.last_page))}>Add a lesson</button>
          <button type="button" className="btn btn-primary" disabled={!!problem || saving} onClick={confirm}>
            {saving ? "Starting…" : `Extract vocabulary from ${included} lesson${included === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </section>
  );
}

function LessonsReview({ job, languageId, languageName }: { job: Job; languageId: string; languageName: string }) {
  const [lessons, setLessons] = useState<LessonProgress[] | null>(null);
  const [status, setStatus] = useState(job.status);
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<number, { lessonId: string; count: number }>>({});

  const load = useCallback(async () => {
    const r = await getLanguageCandidates(job.id);
    setLessons(r.lessons);
    setStatus(r.status);
    setNotes(r.warnings);
    return r.status;
  }, [job.id]);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const s = await load();
        if (alive && s === "extracting") timer = setTimeout(tick, 3000);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Could not load the results");
      }
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [load]);

  if (error) return <div role="alert" className="card max-w-2xl">✗ {error}</div>;
  if (!lessons) return <div className="card max-w-2xl" aria-busy="true">Loading the results…</div>;

  const ready = lessons.filter((l) => l.status === "done").length;
  const addedCount = lessons.filter((l) => added[l.index] || l.created_lesson_id).length;
  const firstOpen = lessons.findIndex((l) => l.status === "done" && !l.created_lesson_id && !added[l.index]);

  return (
    <section className="flex flex-col gap-4">
      <header className="card flex flex-col gap-2">
        <h2>{job.filename}</h2>
        <p aria-live="polite">
          {ready} of {lessons.length} lessons ready · {addedCount} added to "{languageName}"
          {status === "extracting" ? " · still reading the rest…" : ""}
        </p>
        {status === "extracting" && <ProgressBar current={lessons.filter((l) => l.status !== "pending").length} total={lessons.length} showPercent={false} />}
        <p className="text-xs opacity-60">Review each lesson and add it when you are happy. Nothing is created until you press "Add".</p>
        {notes.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm">{notes.length} note{notes.length > 1 ? "s" : ""} from the import</summary>
            <ul className="list-disc pl-5 text-sm">{notes.map((w) => <li key={w}>{w}</li>)}</ul>
          </details>
        )}
        <div className="btn-row"><Link href={`/languages/${languageId}`} className="btn btn-secondary">Back to the language</Link></div>
      </header>

      {lessons.map((l, i) => (
        <LessonSection key={l.index} job={job} lesson={l} languageId={languageId} defaultOpen={i === firstOpen}
          added={added[l.index]} onAdded={(r) => setAdded((a) => ({ ...a, [l.index]: r }))} />
      ))}
    </section>
  );
}

// Each lesson owns its open/closed state: adding one must not collapse it (its confirmation is inside) or
// shift which section is open.
function LessonSection({ job, lesson: l, languageId, defaultOpen, added, onAdded }: {
  job: Job; lesson: LessonProgress; languageId: string; defaultOpen: boolean;
  added?: { lessonId: string; count: number }; onAdded: (r: { lessonId: string; count: number }) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const createdId = added?.lessonId ?? l.created_lesson_id;
  return (
    <details className="card" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer">
        <strong>{l.title}</strong> · pages {l.start_page}-{l.end_page} ·{" "}
        {createdId ? "✓ Added" : l.status === "pending" ? "Waiting…" : l.status === "failed" ? "⚠ Failed"
          : `${l.counts?.total ?? 0} found, ${l.counts?.flagged ?? 0} to check`}
      </summary>
      <div className="mt-3">
        {l.status === "failed" && <p role="alert">✗ {l.error ?? "This lesson could not be read."}</p>}
        {l.status === "pending" && <p className="opacity-70">This lesson has not been read yet.</p>}
        {createdId && (
          <p role="status">
            Added {added ? `${added.count} ${added.count === 1 ? "entry" : "entries"}` : "its entries"}.{" "}
            <Link className="link underline" href={`/languages/${languageId}/lesson/${createdId}`}>Open the lesson</Link>
          </p>
        )}
        {l.status === "done" && !createdId && (
          <ReviewPanel jobId={job.id} filename={job.filename} candidates={[...(l.candidates ?? []), ...flattenElements(l.elements)]} range={[l.start_page, l.end_page]}
            addLabel={(n) => `Add ${n} to a new lesson "${l.title}"`}
            onAdd={async (payload) => {
              const r = await acceptLesson(job.id, l.index, payload.items, undefined, payload.elements);
              onAdded({ lessonId: r.lesson_id, count: r.created + (r.created_elements ?? 0) });
            }} />
        )}
      </div>
    </details>
  );
}
