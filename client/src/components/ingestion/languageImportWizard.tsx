"use client";

import { ChevronRight } from "lucide-react";
import JobControls from "./jobControls";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useDeleteWhenFinished } from "./useDeleteWhenFinished";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import ProgressBar from "@/components/ui/progressBar";
import {
  ACTIVE_STATUSES, type Job, type LessonProgress, type Structure, acceptLesson, confirmStructure, deleteJob, getJob,
  flattenElements, getLanguageCandidates, getStructure, stepBack,
} from "@/api/ingestion";
import {
  type Draft, addDraft, draftRanges, draftsFromProposal, estimateCalls, removeDraft, toConfirmPayload, validateDrafts,
} from "@/lib/ingestion/structure";
import { LANGUAGE_to_ISO639_2T } from "@/utils/language_iso639";
import { expandRanges, formatRanges, lessonRanges, parsePageRanges } from "@/lib/ingestion/ranges";
import PageRanges from "./pageRanges";
import StepProgress from "./stepProgress";
import { UploadStep } from "./importWizard";
import ReviewPanel from "./reviewPanel";
import { PageKindsWithViewer } from "./pageKinds";

type Props = { languageId: string; languageName: string; settingsHref: string };

// Whole-book import: upload -> (parse) -> choose the lessons -> per-lesson extraction -> review and add each lesson.
export default function LanguageImportWizard(props: Props) {
  const t = useTranslations("ingestion");
  const jobId = useSearchParams().get("job");
  const base = `/languages/${props.languageId}/import`;
  const languageCode = LANGUAGE_to_ISO639_2T[props.languageName] || "zho";
  return jobId ? <JobView key={jobId} jobId={jobId} base={base} {...props} /> : (
    <UploadStep languageId={props.languageId} heading={t("importHeadingLanguage", { languageName: props.languageName })}
      settingsHref={props.settingsHref} base={base} cancelHref={`/languages/${props.languageId}`}
      languageCode={languageCode} showLevel={true} />
  );
}

function JobView({ jobId, languageId, languageName, settingsHref, base }: Props & { jobId: string; base: string }) {
  const router = useRouter();
  const t = useTranslations("ingestion");
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
        if (alive) setError(e instanceof Error ? e.message : t("couldNotLoad"));
      }
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [jobId, nonce]);

  const startOver = async () => {
    await deleteJob(jobId).catch(() => undefined);
    router.replace(base);
  };

  if (error) return <div role="alert" className="card max-w-2xl">✗ {error} <Link href={base} className="link">{t("startANewImport")}</Link></div>;
  if (!job) return <div className="card max-w-2xl" aria-busy="true">{t("loadingEllipsis")}</div>;

  if (job.status === "queued" || job.status === "parsing") {
    const STATUS_TEXT: Record<string, string> = {
      queued: t("waitingForTurn"), parsing: t("readingDocument"),
    };
    return (
      <div className="card step-header flex max-w-2xl flex-col">
        <StepProgress step={1} second={t("chooseTheLessons")} />
        <h2>{job.filename}</h2>
        <p aria-live="polite">{STATUS_TEXT[job.status]}</p>
        {job.status === "parsing" && job.pages_total > 0 && (
          <ProgressBar current={job.pages_done} total={job.pages_total} label={t("pagesRead", { done: job.pages_done, total: job.pages_total })} />
        )}
        <p className="text-sm opacity-70">
          {t("languageImportTakesTime")}
        </p>
        <div className="btn-row"><JobControls jobId={job.id} paused={job.paused} onStopped={async () => setJob(await getJob(jobId))} /></div>
      </div>
    );
  }
  if (job.status === "failed") {
    return (
      <div role="alert" className="card flex max-w-2xl flex-col gap-3">
        <h2>{t("importFailed")}</h2>
        <p>{job.error}</p>
        {/endpoint/i.test(job.error ?? "") && <Link href={settingsHref} className="link">{t("goToSettings")}</Link>}
        <div className="btn-row">
          <button className="btn btn-secondary" onClick={() => stepBack(jobId).then(() => { setJob({ ...job, status: "structure" }); setNonce((n) => n + 1); }).catch(() => {})}>{t("backToTheLessons")}</button>
          <button className="btn btn-primary" onClick={startOver}>{t("tryAnotherDocument")}</button>
        </div>
      </div>
    );
  }
  if (job.status === "structure") {
    return <StructureStep job={job} onRestart={startOver} onConfirmed={() => { setJob({ ...job, status: "extracting" }); setNonce((n) => n + 1); }} />;
  }
  return <LessonsReview job={job} languageId={languageId} languageName={languageName} onStopped={async () => setJob(await getJob(jobId))}
    onBack={async () => { await stepBack(jobId); setJob({ ...job, status: "structure" }); setNonce((n) => n + 1); }} />;
}

function StructureStep({ job, onConfirmed, onRestart }: { job: Job; onConfirmed: () => void; onRestart: () => void }) {
  const t = useTranslations("ingestion");
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
  if (!structure) return <div className="card max-w-2xl" aria-busy="true">{t("loadingTheLessons")}</div>;

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
      setError(e instanceof Error ? e.message : t("couldNotStartExtraction"));
      setSaving(false);
    }
  };

  return (
    <section className="flex max-w-4xl flex-col gap-4">
      <header className="card step-header flex flex-col">
        <StepProgress step={2} second={t("chooseTheLessons")} />
        <h2>{t("whichLessons", { filename: job.filename })}</h2>
        <p className="text-sm opacity-70">
          {t("structureIntro", { first: structure.first_page, last: structure.last_page })}
        </p>
        {structure.warnings.length > 0 && (
          <ul className="list-disc pl-5 text-sm">{structure.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        )}
      </header>

      <ul className="flex flex-col gap-2">
        {drafts.map((d, i) => {
          const ranges = draftRanges(d);
          const lessonPages = ranges.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, idx) => a + idx));
          const check = parsePageRanges(d.ranges, structure.first_page, structure.last_page);
          return (
            <li key={i} className="card flex flex-col gap-2">
              <div className="flex flex-wrap items-end gap-3">
                <input type="checkbox" className="mb-3" checked={d.include} aria-label={t("includeLessonAria", { n: i + 1 })} onChange={(e) => set(i, { include: e.target.checked })} />
                <label className="flex min-w-48 flex-[3] flex-col gap-1">
                  <span className="text-xs opacity-60">{t("title")}</span>
                  <input className="input" value={d.title} onChange={(e) => set(i, { title: e.target.value })} />
                </label>
                {d.verified !== null && (
                  <span className="badge mb-2" title={d.verified ? t("titleOnFirstPage") : t("titleNotOnFirstPage")}>
                    {d.verified ? t("foundOnPage") : t("checkBadge")}
                  </span>
                )}
                <button type="button" className="btn btn-secondary mb-1" aria-label={t("removeLessonAria", { n: i + 1 })} onClick={() => setDrafts((ds) => removeDraft(ds, i))}>×</button>
              </div>
              <PageRanges rows={d.ranges} onChange={(r) => set(i, { ranges: r })} first={structure.first_page} last={structure.last_page}
                errorRow={check.ok ? undefined : check.row} error={check.ok ? undefined : check.error} />
              {d.note && <p className="text-sm">⚠ {d.note}</p>}
              {d.include && lessonPages.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer opacity-70">{t("confirmKindsOnPages", { ranges: formatRanges(ranges) })}</summary>
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
          {t("lessonsSummary", { included, calls })}
        </p>
        {(problem || error) && <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>✗ {error ?? problem}</p>}
        <div className="btn-row flex-wrap">
          <button type="button" className="btn btn-secondary" disabled={saving} onClick={onRestart}>{t("chooseAnotherDocument")}</button>
          <button type="button" className="btn btn-secondary" onClick={() => setDrafts((ds) => addDraft(ds, structure.last_page))}>{t("addALesson")}</button>
          <button type="button" className="btn btn-primary" disabled={!!problem || saving} onClick={confirm}>
            {saving ? t("startingEllipsis") : t("extractContentOfLessons", { count: included })}
          </button>
        </div>
      </div>
    </section>
  );
}

function LessonsReview({ job, languageId, languageName, onBack, onStopped }: { job: Job; languageId: string; languageName: string; onBack: () => Promise<void>; onStopped: () => void }) {
  const t = useTranslations("ingestion");
  const [lessons, setLessons] = useState<LessonProgress[] | null>(null);
  const [status, setStatus] = useState(job.status);
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<number, { lessonId: string; count: number; notes?: string[] }>>({});

  const everyLessonAdded = status !== "extracting" && !!lessons && lessons.some((l) => l.status === "done")
    && lessons.every((l) => l.status !== "done" || added[l.index] || l.created_lesson_id);
  useDeleteWhenFinished(job.id, everyLessonAdded);

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
        if (alive) setError(e instanceof Error ? e.message : t("couldNotLoadResults"));
      }
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [load]);

  if (error) return <div role="alert" className="card max-w-2xl">✗ {error}</div>;
  if (!lessons) return <div className="card max-w-2xl" aria-busy="true">{t("loadingResults")}</div>;

  const ready = lessons.filter((l) => l.status === "done").length;
  const addedCount = lessons.filter((l) => added[l.index] || l.created_lesson_id).length;
  const firstOpen = lessons.findIndex((l) => l.status === "done" && !l.created_lesson_id && !added[l.index]);

  return (
    <section className="flex flex-col gap-4">
      <header className="card step-header flex flex-col">
        <StepProgress step={3} second={t("chooseTheLessons")} />
        <div className="step-header-top">
          <h2>{job.filename}</h2>
          <div className="btn-row">
            {status !== "extracting" && addedCount === 0 && (
              <button type="button" className="btn btn-secondary" onClick={() => onBack().catch((e) => setError(e instanceof Error ? e.message : t("couldNotGoBack")))}>{t("backToTheLessons")}</button>
            )}
            <Link href={`/languages/${languageId}`} className="btn btn-secondary">{t("backToTheLanguage")}</Link>
          </div>
        </div>
        <p aria-live="polite">
          {t("lessonsProgress", { ready, total: lessons.length, added: addedCount, languageName, reading: status === "extracting" ? "yes" : "no" })}
        </p>
        {status === "extracting" && <ProgressBar current={lessons.filter((l) => l.status !== "pending").length} total={lessons.length} showPercent={false} />}
        {status === "extracting" && <div className="btn-row"><JobControls jobId={job.id} paused={job.paused} onStopped={onStopped} /></div>}
        <p className="text-xs opacity-60">{t("reviewEachLesson")}</p>
        {notes.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm">{t("notesFromImport", { count: notes.length })}</summary>
            <ul className="list-disc pl-5 text-sm">{notes.map((w) => <li key={w}>{w}</li>)}</ul>
          </details>
        )}
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
  added?: { lessonId: string; count: number; notes?: string[] }; onAdded: (r: { lessonId: string; count: number; notes?: string[] }) => void;
}) {
  const t = useTranslations("ingestion");
  const [open, setOpen] = useState(defaultOpen);
  const createdId = added?.lessonId ?? l.created_lesson_id;
  const [live, setLive] = useState<{ total: number; flagged: number } | null>(null);   // follows the user's rejects / merges in the review
  const shown = [...(l.candidates ?? []), ...flattenElements(l.elements)];   // stored counts predate grammar / exercises
  return (
    <details className="card" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 [&::-webkit-details-marker]:hidden">
        <ChevronRight size={18} aria-hidden className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
        <strong className="min-w-0 flex-1 break-words">{l.title}</strong>
        <span className="text-sm text-muted">{t("lessonPagesRange", { ranges: formatRanges(lessonRanges(l)) })}</span>
        <span className="badge">
          {createdId ? t("lessonAdded") : l.status === "pending" ? t("lessonWaiting") : l.status === "failed" ? t("lessonFailed")
            : t("lessonCounts", live ?? { total: shown.length || (l.counts?.total ?? 0), flagged: shown.length ? shown.filter((c) => c.status !== "verified").length : (l.counts?.flagged ?? 0) })}
        </span>
      </summary>
      <div className="mt-4 border-t border-border pt-4">
        {l.status === "failed" && <p role="alert">✗ {l.error ?? t("lessonCouldNotBeRead")}</p>}
        {l.status === "pending" && <p className="opacity-70">{t("lessonNotReadYet")}</p>}
        {createdId && (
          <p role="status">
            {added ? t("lessonAddedCount", { count: added.count }) : t("lessonAddedItsEntries")}{" "}
            <Link className="link underline" href={`/languages/${languageId}/lesson/${createdId}`}>{t("openTheLesson")}</Link>
            {added?.notes && added.notes.length > 0 && <span className="mt-1 block text-sm">{added.notes.join(" ")}</span>}
          </p>
        )}
        {l.status === "done" && !createdId && (
          <ReviewPanel onCounts={setLive} jobId={job.id} filename={job.filename} candidates={[...(l.candidates ?? []), ...flattenElements(l.elements)]} range={[l.start_page, l.end_page]} pages={expandRanges(lessonRanges(l))}
            addLabel={(n) => t("addToNewLesson", { count: n, title: l.title })}
            onAdd={async (payload) => {
              const r = await acceptLesson(job.id, l.index, payload.items, undefined, payload.elements);
              onAdded({ lessonId: r.lesson_id, count: r.created + (r.created_elements ?? 0), notes: r.notes });
            }} />
        )}
      </div>
    </details>
  );
}
