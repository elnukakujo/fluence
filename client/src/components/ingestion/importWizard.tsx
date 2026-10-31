"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { type AcceptPayload } from "@/lib/ingestion/review";
import ProgressBar from "@/components/ui/progressBar";
import {
  ACTIVE_STATUSES, type Capabilities, type Job, type SourceMetadata, acceptCandidates, confirmPages, deleteJob, getCandidates, getCapabilities,
  getJob, getPages, stepBack, uploadDocument,
} from "@/api/ingestion";
import { type Candidate, pageSpan, parsePageRange } from "@/lib/ingestion/review";
import ReviewPanel from "./reviewPanel";
import { PageKindsWithViewer } from "./pageKinds";
import StepProgress from "./stepProgress";
import FilePreview from "./filePreview";
import SourceStep, { type SourceStepData } from "./sourceStep";

type Props = { languageId: string; lessonId: string; lessonTitle: string; settingsHref: string };

// ?job=<id> in the URL makes an import resumable: refresh, or come back from the Imports menu.
export default function ImportWizard(props: Props) {
  const jobId = useSearchParams().get("job");
  return jobId ? <JobView key={jobId} jobId={jobId} {...props} /> : (
    <UploadStep languageId={props.languageId} lessonId={props.lessonId} heading={`Import into “${props.lessonTitle}”`}
      settingsHref={props.settingsHref} base={`/languages/${props.languageId}/lesson/${props.lessonId}/import`}
      cancelHref={`/languages/${props.languageId}/lesson/${props.lessonId}`} />
  );
}

// Shared by lesson-level (lessonId set) and language-level (no lesson) imports.
export function UploadStep({ languageId, lessonId, heading, settingsHref, base, cancelHref, languageCode = "zho", showLevel = false }: {
  languageId: string; lessonId?: string; heading: string; settingsHref: string; base: string; cancelHref: string; languageCode?: string; showLevel?: boolean;
}) {
  const router = useRouter();
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
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
    const range = parsePageRange(from, to);
    if (!range.ok) return setError(range.error);
    if (!file) return setError("Choose a PDF or an image first");
    const form = new FormData();
    form.append("file", file);
    form.append("language_id", languageId);
    if (lessonId) form.append("lesson_id", lessonId);
    if (handwritten) form.append("handwritten", "true");
    if (range.range) { form.append("page_from", String(range.range[0])); form.append("page_to", String(range.range[1])); }
    if (source.source_title) form.append("source_title", source.source_title);
    if (source.source_type) form.append("source_type", source.source_type);
    if (source.source_description) form.append("source_description", source.source_description);
    if (source.level) form.append("level", String(source.level));
    setBusy(true);
    setError(null);
    try {
      const { job_id } = await uploadDocument(form);
      router.replace(`${base}?job=${job_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card step-header flex max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-3">
      <StepProgress step={1} second={lessonId ? "Choose the pages" : "Choose the lessons"} />
        <h2>{heading}</h2>
        <p className="text-sm opacity-70">
          We read the document, find the vocabulary, grammar, calligraphy and exercises, and show you everything to check next to the original page. Nothing is added until you confirm.
        </p>
      </div>

      {blocked && (
        <div role="alert" className="card text-sm">
          <p className="font-medium">You can&apos;t import yet</p>
          <ul className="list-disc pl-4">{caps!.reasons.map((r) => <li key={r.code}>{r.message}</li>)}</ul>
          <Link href={settingsHref} className="link mt-2 inline-block">Go to Settings</Link>
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-sm opacity-70">Document (PDF or image)</span>
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
        <legend className="text-sm opacity-70">Pages (optional)</legend>
        <div className="flex flex-wrap items-center gap-2">
          <input className="input w-24" inputMode="numeric" aria-label="First page" placeholder="from" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span aria-hidden>–</span>
          <input className="input w-24" inputMode="numeric" aria-label="Last page" placeholder="to" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <span className="text-xs opacity-60">
          Leave empty to read the whole document. For a long book, pick just the pages of this lesson: it is faster
          and cheaper, because each page is one call to your text model.
        </span>
      </fieldset>

      {file && (
        <details className="text-sm" open>
          <summary className="cursor-pointer opacity-70">Look through the document to find your pages</summary>
          <div className="mt-2"><FilePreview file={file} page={/^\d+$/.test(from.trim()) ? Number(from) : undefined} /></div>
        </details>
      )}

      <label className="flex items-start gap-2">
        <input type="checkbox" checked={handwritten} disabled={blocked || busy} onChange={(e) => setHandwritten(e.target.checked)} />
        <span className="text-sm">This document is handwritten</span>
      </label>
      {handwritten && noVision && (
        <p className="text-sm" role="note">
          ⚠ Handwriting is read best by a vision model and you haven&apos;t added one, so expect many items to need checking.{" "}
          <Link href={settingsHref} className="link">Add one in Settings</Link>
        </p>
      )}

      {error && <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>✗ {error}</p>}
      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={blocked || busy || !file}>{busy ? "Uploading…" : "Start import"}</button>
        <Link href={cancelHref} className="btn btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}

export const STATUS_TEXT: Record<string, string> = {
  queued: "Waiting for its turn…", parsing: "Reading the document…", pages: "Classifying pages…", extracting: "Finding vocabulary, grammar, calligraphy and exercises…",
};

function JobView({ jobId, languageId, lessonId, lessonTitle, settingsHref }: Props & { jobId: string }) {
  const router = useRouter();
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
        if (alive) setError(e instanceof Error ? e.message : "Could not load this import");
      }
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [jobId]);

  const startOver = async () => {
    await deleteJob(jobId).catch(() => undefined);
    router.replace(base);
  };

  if (error) return <div role="alert" className="card max-w-2xl">✗ {error} <Link href={base} className="link">Start a new import</Link></div>;
  if (!job) return <div className="card max-w-2xl" aria-busy="true">Loading…</div>;

  if (job.status === "pages") {
    return <PagesStep job={job} lessonId={lessonId} lessonTitle={lessonTitle} base={base} onRestart={startOver} />;
  }
  if (ACTIVE_STATUSES.includes(job.status)) {
    return (
      <div className="card step-header flex max-w-2xl flex-col">
        <StepProgress step={job.status === "extracting" ? 3 : 1} second="Choose the pages" />
        <h2>{job.filename}</h2>
        <p aria-live="polite">{STATUS_TEXT[job.status]}</p>
        {job.status === "extracting" && <ProgressBar current={job.pages_done} total={job.pages_total} />}
        <p className="text-sm opacity-70">
          This can take several minutes for a long scan. You can leave this page: find the import under “Imports” in the top bar.
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
  return <Review job={job} lessonId={job.lesson_id ?? lessonId} lessonTitle={lessonTitle} languageId={languageId} base={base}
    onBack={async () => { await stepBack(jobId); setJob(await getJob(jobId)); }} />;
}


function PagesStep({ job, lessonId, lessonTitle, base, onRestart }: {
  onRestart: () => void; job: Job; lessonId: string; lessonTitle: string; base: string;
}) {
  const router = useRouter();
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
  if (!pagesData) return <div className="card max-w-2xl" aria-busy="true">Loading pages...</div>;

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
      setError(e instanceof Error ? e.message : "Could not confirm the pages");
      setSaving(false);
    }
  };

  return (
    <section className="flex max-w-4xl flex-col gap-4">
      <header className="card step-header flex flex-col">
        <StepProgress step={2} second="Choose the pages" />
        <h2>Confirm page kinds in {job.filename}</h2>
        <p className="text-sm opacity-70">We detected which kinds of content are on each page. Review and edit as needed, then continue to extraction.</p>
        {pagesData.warnings.length > 0 && (<ul className="list-disc pl-5 text-sm">{pagesData.warnings.map((w) => <li key={w}>{w}</li>)}</ul>)}
      </header>
      <PageKindsWithViewer pages={pages} value={pageKinds as any} onChange={(newPageKinds) => setPageKinds(newPageKinds as any)} jobId={job.id} />
      {error && <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>Error: {error}</p>}
      <div className="btn-row flex-wrap">
        <button type="button" className="btn btn-secondary" disabled={saving} onClick={onRestart}>← Choose another document</button>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={confirm}>{saving ? "Starting..." : "Continue to extraction"}</button>
      </div>
    </section>
  );
}


function Review({ job, lessonId, lessonTitle, languageId, base, onBack }: {
  onBack: () => Promise<void>; job: Job; lessonId: string; lessonTitle: string; languageId: string; base: string;
}) {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<number | null>(null);
  const [addNotes, setAddNotes] = useState<string[]>([]);
  const [canAudio, setCanAudio] = useState(false);

  useEffect(() => { Promise.resolve(getCapabilities(languageId, lessonId)).then((c) => setCanAudio(!!c?.can_generate_audio)).catch(() => undefined); }, [languageId, lessonId]); 

  useEffect(() => {
    getCandidates(job.id).then((r) => { setCandidates(r.candidates); setNotes(r.warnings); }).catch((e) => setError(e.message));
  }, [job.id]);

  if (added !== null) {
    return (
      <div className="card flex max-w-2xl flex-col gap-3" role="status">
        <h2>Added {added} {added === 1 ? "entry" : "entries"} to “{lessonTitle}”</h2>
        <p className="text-sm opacity-70">They are tagged with the source “{job.source_title || `Imported from ${job.filename}`}”.</p>
        {addNotes.length > 0 && <ul className="list-disc pl-5 text-sm" role="note">{addNotes.map((n) => <li key={n}>{n}</li>)}</ul>}
        <div className="btn-row">
          <Link href={`/languages/${languageId}/lesson/${lessonId}`} className="btn btn-primary">Back to the lesson</Link>
          <button className="btn btn-secondary" onClick={() => router.push(base)}>Import another document</button>
        </div>
      </div>
    );
  }
  if (error) return <div role="alert" className="card max-w-2xl">✗ {error}</div>;
  if (!candidates) return <div className="card max-w-2xl" aria-busy="true">Loading the results…</div>;

  const warnings = [...job.warnings, ...notes.filter((n) => !job.warnings.includes(n))];
  return (
    <section className="flex flex-col gap-4">
      <header className="card step-header flex flex-col">
        <StepProgress step={3} second="Choose the pages" />
        <h2>Review what we found in {job.filename}</h2>
        {warnings.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm">{warnings.length} note{warnings.length > 1 ? "s" : ""} from the import</summary>
            <ul className="list-disc pl-5 text-sm">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </details>
        )}
      </header>
      <ReviewPanel jobId={job.id} filename={job.filename} candidates={candidates} range={pageSpan(job.page_kinds)}
        addLabel={(n) => `Add ${n} to “${lessonTitle}”`}
        canGenerateAudio={canAudio}
        onAdd={async (payload) => { const r = await acceptCandidates(job.id, lessonId, payload.items, payload.elements); setAddNotes(r.notes ?? []); setAdded(r.created + (r.created_elements ?? 0)); }} />
      <div className="btn-row">
        <button className="btn btn-secondary" onClick={() => onBack().catch((e) => setError(e instanceof Error ? e.message : "Could not go back"))}>← Back to the pages</button>
        <button className="btn btn-secondary" onClick={() => router.push(`/languages/${languageId}/lesson/${lessonId}`)}>Leave without adding</button>
      </div>
    </section>
  );
}
