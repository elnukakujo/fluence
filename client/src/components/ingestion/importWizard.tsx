"use client";

import JobControls from "./jobControls";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useDeleteWhenFinished } from "./useDeleteWhenFinished";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { type AcceptPayload } from "@/lib/ingestion/review";
import ProgressBar from "@/components/ui/progressBar";
import {
  ACTIVE_STATUSES, type Capabilities, type Job, type SourceMetadata, acceptCandidates, confirmPages, deleteJob, getCandidates, getCapabilities,
  getJob, getPages, stepBack, uploadDocument,
} from "@/api/ingestion";
import { type Candidate, pageSpan } from "@/lib/ingestion/review";
import { type RangeDraft, parsePageRanges } from "@/lib/ingestion/ranges";
import PageRanges from "./pageRanges";
import ReviewPanel from "./reviewPanel";
import { PageKindsWithViewer } from "./pageKinds";
import StepProgress from "./stepProgress";
import FilePreview from "./filePreview";
import SourceStep, { type SourceStepData } from "./sourceStep";

type Props = { languageId: string; lessonId: string; lessonTitle: string; settingsHref: string };

// ?job=<id> in the URL makes an import resumable: refresh, or come back from the Imports menu.
export default function ImportWizard(props: Props) {
  const t = useTranslations("ingestion");
  const jobId = useSearchParams().get("job");
  return jobId ? <JobView key={jobId} jobId={jobId} {...props} /> : (
    <UploadStep languageId={props.languageId} lessonId={props.lessonId} heading={t("importHeadingLesson", { lessonTitle: props.lessonTitle })}
      settingsHref={props.settingsHref} base={`/languages/${props.languageId}/lesson/${props.lessonId}/import`}
      cancelHref={`/languages/${props.languageId}/lesson/${props.lessonId}`} />
  );
}

// Shared by lesson-level (lessonId set) and language-level (no lesson) imports.
export function UploadStep({ languageId, lessonId, heading, settingsHref, base, cancelHref, languageCode = "zho", showLevel = false }: {
  languageId: string; lessonId?: string; heading: string; settingsHref: string; base: string; cancelHref: string; languageCode?: string; showLevel?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("ingestion");
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<RangeDraft[]>([{ start: "", end: "" }]);
  const [rangeError, setRangeError] = useState<{ row: number; message: string } | null>(null);
  const [handwritten, setHandwritten] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<SourceStepData>({
    source_title: "",
    source_type: "textbook",
    source_description: "",
  });

  useEffect(() => { getCapabilities(languageId, lessonId).then(setCaps).catch((e) => setError(e.message)); }, [languageId, lessonId]);

  const blocked = !!caps && !caps.can_import;
  const noVision = !!caps?.warnings.some((w) => w.code === "no_vision_endpoint");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const range = parsePageRanges(rows);
    if (!range.ok) { setRangeError({ row: range.row, message: range.error }); return; }
    setRangeError(null);
    if (!file) return setError(t("chooseFileFirst"));
    const form = new FormData();
    form.append("file", file);
    form.append("language_id", languageId);
    if (lessonId) form.append("lesson_id", lessonId);
    if (handwritten) form.append("handwritten", "true");
    if (range.ranges) form.append("page_ranges", JSON.stringify(range.ranges));
    if (source.source_title) form.append("source_title", source.source_title);
    if (source.source_type) form.append("source_type", source.source_type);
    if (source.source_description) form.append("source_description", source.source_description);
    if (source.level !== undefined) form.append("level", String(source.level));   // 0 is the first level
    setBusy(true);
    setError(null);
    try {
      const { job_id } = await uploadDocument(form);
      router.replace(`${base}?job=${job_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("uploadFailed"));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card step-header flex max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-3">
      <StepProgress step={1} second={lessonId ? t("chooseThePages") : t("chooseTheLessons")} />
        <h2>{heading}</h2>
        <p className="text-sm opacity-70">
          {t("readingDescription")}
        </p>
      </div>

      {blocked && (
        <div role="alert" className="card text-sm">
          <p className="font-medium">{t("cantImportYet")}</p>
          <ul className="list-disc pl-4">{caps!.reasons.map((r) => <li key={r.code}>{r.message}</li>)}</ul>
          <Link href={settingsHref} className="link mt-2 inline-block">{t("goToSettings")}</Link>
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-sm opacity-70">{t("documentLabel")}</span>
        <input className="input" type="file" accept=".pdf,image/*" disabled={blocked || busy}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>

      {file && (
        <SourceStep
          filename={file.name}
          onSourceChange={setSource}
          languageCode={languageCode}
          showLevel={showLevel}
        />
      )}

      <fieldset className="flex flex-col gap-1" disabled={blocked || busy}>
        <legend className="text-sm opacity-70">{t("pagesLabel")}</legend>
        <PageRanges rows={rows} onChange={(r) => { setRows(r); setRangeError(null); }} disabled={blocked || busy}
          errorRow={rangeError?.row} error={rangeError?.message} />
        <span className="text-xs opacity-60">
          {t("pagesHint")}
        </span>
      </fieldset>

      {file && (
        <details className="text-sm" open>
          <summary className="cursor-pointer opacity-70">{t("lookThroughDocument")}</summary>
          <div className="mt-2"><FilePreview file={file} page={/^\d+$/.test(rows[0].start.trim()) ? Number(rows[0].start) : undefined} /></div>
        </details>
      )}

      <label className="flex items-start gap-2">
        <input type="checkbox" checked={handwritten} disabled={blocked || busy} onChange={(e) => setHandwritten(e.target.checked)} />
        <span className="text-sm">{t("handwrittenLabel")}</span>
      </label>
      {handwritten && noVision && (
        <p className="text-sm" role="note">
          ⚠ {t("handwrittenWarning")} {" "}
          <Link href={settingsHref} className="link">{t("addOneInSettings")}</Link>
        </p>
      )}

      {error && <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>✗ {error}</p>}
      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={blocked || busy || !file}>{busy ? t("uploadingButton") : t("uploadButton")}</button>
        <Link href={cancelHref} className="btn btn-secondary">{t("cancelButton")}</Link>
      </div>
    </form>
  );
}

// STATUS_TEXT is now generated from translations in components that use it

function JobView({ jobId, languageId, lessonId, lessonTitle, settingsHref }: Props & { jobId: string }) {
  const router = useRouter();
  const t = useTranslations("ingestion");
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = `/languages/${languageId}/lesson/${lessonId}/import`;

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
  }, [jobId]);

  const startOver = async () => {
    await deleteJob(jobId).catch(() => undefined);
    router.replace(base);
  };

  if (error) return <div role="alert" className="card max-w-2xl">✗ {error} <Link href={base} className="link">{t("uploadButton")}</Link></div>;
  if (!job) return <div className="card max-w-2xl" aria-busy="true">{t("loadingEllipsis")}</div>;

  if (job.status === "pages") {
    return <PagesStep job={job} lessonId={lessonId} lessonTitle={lessonTitle} base={base} onRestart={startOver} />;
  }
  if (ACTIVE_STATUSES.includes(job.status)) {
    const STATUS_TEXT: Record<string, string> = {
      queued: t("waitingForTurn"), parsing: t("readingDocument"), pages: t("classifyingPages"), extracting: t("findingContent"),
    };
    return (
      <div className="card step-header flex max-w-2xl flex-col">
        <StepProgress step={job.status === "extracting" ? 3 : 1} second={t("chooseTheLessons")} />
        <h2>{job.filename}</h2>
        <p aria-live="polite">{STATUS_TEXT[job.status]}</p>
        {job.status === "extracting" && <ProgressBar active current={job.pages_done} total={job.pages_total} />}
        {job.status === "parsing" && job.pages_total > 0 && (
          <ProgressBar active current={job.pages_done} total={job.pages_total} label={t("pagesRead", { done: job.pages_done, total: job.pages_total })} />
        )}
        <p className="text-sm opacity-70">
          {t("importTakesTime")}
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
          <button className="btn btn-secondary" onClick={() => stepBack(jobId).then(async () => setJob(await getJob(jobId))).catch(() => {})}>{t("backToPages")}</button>
          <button className="btn btn-primary" onClick={startOver}>{t("tryAnotherDocument")}</button>
        </div>
      </div>
    );
  }
  return <Review job={job} lessonId={job.lesson_id ?? lessonId} lessonTitle={lessonTitle} languageId={languageId} base={base}
    onBack={async () => { await stepBack(jobId); setJob(await getJob(jobId)); }} />;
}


function PagesStep({ job, lessonId, lessonTitle, base, onRestart }: {
  onRestart: () => void; job: Job; lessonId: string; lessonTitle: string; base: string;
}) {
  const router = useRouter();
  const t = useTranslations("ingestion");
  const [pagesData, setPagesData] = useState<{ page_kinds: Record<string, string[]>; first_page: number; last_page: number; warnings: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pageKinds, setPageKinds] = useState<Record<number, string[]>>({});

  useEffect(() => {
    getPages(job.id)
      .then((data) => {
        setPagesData(data);
        const kindsByNumber: Record<number, string[]> = {};
        for (const [key, kinds] of Object.entries(data.page_kinds)) {
          kindsByNumber[parseInt(key, 10)] = kinds;
        }
        setPageKinds(kindsByNumber);
      })
      .catch((e) => setError(e.message));
  }, [job.id]);

  if (error && !pagesData) return <div role="alert" className="card max-w-2xl">Error: {error}</div>;
  if (!pagesData) return <div className="card max-w-2xl" aria-busy="true">{t("loadingPages")}</div>;

  const pages = Array.from(
    { length: pagesData.last_page - pagesData.first_page + 1 },
    (_, i) => pagesData.first_page + i
  );

  const confirm = async () => {
    setSaving(true);
    setError(null);
    try {
      const pageKindsStr: Record<string, string[]> = {};
      for (const [key, kinds] of Object.entries(pageKinds)) {
        pageKindsStr[key] = kinds;
      }
      await confirmPages(job.id, pageKindsStr);
      router.push(`${base}?job=${job.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("couldNotConfirmPages"));
      setSaving(false);
    }
  };

  return (
    <section className="flex max-w-4xl flex-col gap-4">
      <header className="card step-header flex flex-col">
        <StepProgress step={2} second={t("chooseThePages")} />
        <h2>{t("confirmPageKinds", { filename: job.filename })}</h2>
        <p className="text-sm opacity-70">{t("confirmPageKindsDescription")}</p>
        {pagesData.warnings.length > 0 && (<ul className="list-disc pl-5 text-sm">{pagesData.warnings.map((w) => <li key={w}>{w}</li>)}</ul>)}
      </header>
      <PageKindsWithViewer pages={pages} value={pageKinds as any} onChange={(newPageKinds) => setPageKinds(newPageKinds as any)} jobId={job.id} />
      {error && <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>Error: {error}</p>}
      <div className="btn-row flex-wrap">
        <button type="button" className="btn btn-secondary" disabled={saving} onClick={onRestart}>{t("startAnotherDocument")}</button>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={confirm}>{saving ? t("startingButton") : t("continueToExtraction")}</button>
      </div>
    </section>
  );
}


function Review({ job, lessonId, lessonTitle, languageId, base, onBack }: {
  onBack: () => Promise<void>; job: Job; lessonId: string; lessonTitle: string; languageId: string; base: string;
}) {
  const router = useRouter();
  const t = useTranslations("ingestion");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<number | null>(null);
  const [addNotes, setAddNotes] = useState<string[]>([]);
  useDeleteWhenFinished(job.id, added !== null);


  useEffect(() => {
    getCandidates(job.id).then((r) => { setCandidates(r.candidates); setNotes(r.warnings); }).catch((e) => setError(e.message));
  }, [job.id]);

  if (added !== null) {
    return (
      <div className="card flex max-w-2xl flex-col gap-3" role="status">
        <h2>{t("addedEntries", { count: added, lessonTitle })}</h2>
        <p className="text-sm opacity-70">{t("taggedWithSource", { sourceTitle: job.source_title || t("importedFrom", { filename: job.filename }) })}</p>
        {addNotes.length > 0 && <ul className="list-disc pl-5 text-sm" role="note">{addNotes.map((n) => <li key={n}>{n}</li>)}</ul>}
        <div className="btn-row">
          <Link href={`/languages/${languageId}/lesson/${lessonId}`} className="btn btn-primary">{t("backToLesson")}</Link>
          <button className="btn btn-secondary" onClick={() => router.push(base)}>{t("importAnother")}</button>
        </div>
      </div>
    );
  }
  if (error) return <div role="alert" className="card max-w-2xl">✗ {error}</div>;
  if (!candidates) return <div className="card max-w-2xl" aria-busy="true">{t("loadingResults")}</div>;

  const warnings = [...job.warnings, ...notes.filter((n) => !job.warnings.includes(n))];
  return (
    <section className="flex flex-col gap-4">
      <header className="card step-header flex flex-col">
        <StepProgress step={3} second={t("chooseThePages")} />
        <h2>{t("reviewResults", { filename: job.filename })}</h2>
        {warnings.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm">{t("notesFromImport", { count: warnings.length })}</summary>
            <ul className="list-disc pl-5 text-sm">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </details>
        )}
      </header>
      <ReviewPanel jobId={job.id} filename={job.filename} candidates={candidates} range={pageSpan(job.page_kinds)}
        addLabel={(n) => t("addButton", { count: n, lessonTitle })}
        onAdd={async (payload) => { const r = await acceptCandidates(job.id, lessonId, payload.items, payload.elements); setAddNotes(r.notes ?? []); setAdded(r.created + (r.created_elements ?? 0)); }} />
      <div className="btn-row">
        <button className="btn btn-secondary" onClick={() => onBack().catch((e) => setError(e instanceof Error ? e.message : t("couldNotGoBack")))}>{t("backToPages")}</button>
        <button className="btn btn-secondary" onClick={() => router.push(`/languages/${languageId}/lesson/${lessonId}`)}>{t("leaveWithoutAdding")}</button>
      </div>
    </section>
  );
}
