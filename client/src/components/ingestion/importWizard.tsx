"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Modal from "@/components/ui/dialogs/modal";
import ProgressBar from "@/components/ui/progressBar";
import {
  ACTIVE_STATUSES, type Capabilities, type Job, acceptCandidates, deleteJob, getCandidates, getCapabilities,
  getJob, pageImageUrl, uploadDocument,
} from "@/api/ingestion";
import {
  type ConflictMode, type Filter, type Row, countRows, filterRows, infoNotes, initialRows, parsePageRange,
  toAcceptItems, warningReasons,
} from "@/lib/ingestion/review";

type Props = { languageId: string; lessonId: string; lessonTitle: string; settingsHref: string };

// ?job=<id> in the URL makes an import resumable: refresh, or come back from the Imports menu.
export default function ImportWizard(props: Props) {
  const jobId = useSearchParams().get("job");
  return jobId ? <JobView key={jobId} jobId={jobId} {...props} /> : <UploadStep {...props} />;
}

function UploadStep({ languageId, lessonId, lessonTitle, settingsHref }: Props) {
  const router = useRouter();
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [handwritten, setHandwritten] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    form.append("lesson_id", lessonId);
    if (handwritten) form.append("handwritten", "true");
    if (range.range) { form.append("page_from", String(range.range[0])); form.append("page_to", String(range.range[1])); }
    setBusy(true);
    setError(null);
    try {
      const { job_id } = await uploadDocument(form);
      router.replace(`/languages/${languageId}/lesson/${lessonId}/import?job=${job_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card flex max-w-2xl flex-col gap-4">
      <div>
        <h2>Import into “{lessonTitle}”</h2>
        <p className="text-sm opacity-70">
          We read the document, find the vocabulary and show you everything to check. Nothing is added until you confirm.
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
        <Link href={`/languages/${languageId}/lesson/${lessonId}`} className="btn btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}

const STATUS_TEXT: Record<string, string> = {
  queued: "Waiting for its turn…", parsing: "Reading the document…", extracting: "Finding the vocabulary…",
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

  if (ACTIVE_STATUSES.includes(job.status)) {
    return (
      <div className="card flex max-w-2xl flex-col gap-3">
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
  return <Review job={job} lessonId={job.lesson_id ?? lessonId} lessonTitle={lessonTitle} languageId={languageId} base={base} />;
}

const CONFLICTS: { value: ConflictMode; label: string }[] = [
  { value: "keep", label: "Keep the existing word" }, { value: "merge", label: "Merge into it" },
  { value: "overwrite", label: "Overwrite it" },
];

function Review({ job, lessonId, lessonTitle, languageId, base }: {
  job: Job; lessonId: string; lessonTitle: string; languageId: string; base: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [preview, setPreview] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState<number | null>(null);

  useEffect(() => {
    getCandidates(job.id).then((r) => { setRows(initialRows(r.candidates)); setNotes(r.warnings); })
      .catch((e) => setError(e.message));
  }, [job.id]);

  const counts = useMemo(() => (rows ? countRows(rows) : null), [rows]);
  const visible = useMemo(() => (rows ? filterRows(rows, filter) : []), [rows, filter]);
  const patch = (id: string, change: Partial<Row>) =>
    setRows((rs) => rs!.map((r) => (r.candidate.id === id ? { ...r, ...change } : r)));
  const toggleVerified = (on: boolean) =>
    setRows((rs) => rs!.map((r) => (r.candidate.status === "verified" ? { ...r, selected: on } : r)));

  const accept = async () => {
    setSaving(true);
    setError(null);
    try {
      setAdded((await acceptCandidates(job.id, lessonId, toAcceptItems(rows!))).created);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the words");
    } finally {
      setSaving(false);
    }
  };

  if (added !== null) {
    return (
      <div className="card flex max-w-2xl flex-col gap-3" role="status">
        <h2>Added {added} {added === 1 ? "entry" : "entries"} to “{lessonTitle}”</h2>
        <p className="text-sm opacity-70">They are tagged with the source “Imported from {job.filename}”.</p>
        <div className="btn-row">
          <Link href={`/languages/${languageId}/lesson/${lessonId}`} className="btn btn-primary">Back to the lesson</Link>
          <button className="btn btn-secondary" onClick={() => router.push(base)}>Import another document</button>
        </div>
      </div>
    );
  }
  if (error && !rows) return <div role="alert" className="card max-w-2xl">✗ {error}</div>;
  if (!rows || !counts) return <div className="card max-w-2xl" aria-busy="true">Loading the results…</div>;

  const warnings = [...job.warnings, ...notes.filter((n) => !job.warnings.includes(n))];
  return (
    <section className="flex flex-col gap-4">
      <header className="card flex flex-col gap-2">
        <h2>Review what we found in {job.filename}</h2>
        <p aria-live="polite">
          {counts.total} found · {counts.verified} confirmed in the text · {counts.flagged} need your check · {counts.selected} selected
        </p>
        <p className="text-xs opacity-60">
          “Confirmed” means the word and its quote appear in the document text. Items that need your check are unselected: compare them with the page before adding.
        </p>
        <div className="btn-row">
          {(["all", "verified", "flagged"] as Filter[]).map((f) => (
            <button key={f} className={`btn ${filter === f ? "btn-primary" : "btn-secondary"}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "verified" ? "Confirmed" : "Need checking"}
            </button>
          ))}
          <button className="btn btn-secondary" onClick={() => toggleVerified(true)}>Select all confirmed</button>
          <button className="btn btn-secondary" onClick={() => toggleVerified(false)}>Clear confirmed</button>
        </div>
        {warnings.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm">{warnings.length} note{warnings.length > 1 ? "s" : ""} from the import</summary>
            <ul className="list-disc pl-5 text-sm">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </details>
        )}
      </header>

      {counts.total === 0 && <p className="card">No vocabulary was found in this document.</p>}

      <ul className="flex flex-col gap-2">
        {visible.map((row) => {
          const c = row.candidate;
          const reasons = warningReasons(c);
          const info = infoNotes(c);
          const exists = c.flags.some((f) => f.code.startsWith("already_in_"));
          return (
            <li key={c.id} className="card flex flex-col gap-2">
              <div className="flex flex-wrap items-start gap-3">
                <input type="checkbox" className="mt-3" checked={row.selected} aria-label={`Include ${row.word || "this word"}`}
                  onChange={(e) => patch(c.id, { selected: e.target.checked })} />
                {(["word", "translation", "phonetic", "word_type"] as const).map((key) => (
                  <label key={key} className="flex min-w-32 flex-1 flex-col gap-1">
                    <span className="text-xs opacity-60">{key === "word_type" ? "type" : key}</span>
                    <input className="input" value={row[key]} onChange={(e) => patch(c.id, { [key]: e.target.value })} />
                  </label>
                ))}
                <span className="badge mt-5" title={c.status === "verified" ? "Found in the document text" : "Could not be confirmed"}>
                  {c.status === "verified" ? "✓ Confirmed" : "⚠ Check this"}
                </span>
              </div>
              {reasons.length > 0 && <ul className="list-disc pl-5 text-sm">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
              {info.length > 0 && <p className="text-sm opacity-70">ℹ {info.join(" ")}</p>}
              {exists && (
                <label className="flex items-center gap-2 text-sm">
                  If it already exists:
                  <select className="input w-auto" value={row.on_conflict} onChange={(e) => patch(c.id, { on_conflict: e.target.value as ConflictMode })}>
                    {CONFLICTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
              )}
              <p className="text-sm opacity-70">
                Page {c.page + 1} · “{c.quote}”{" "}
                <button type="button" className="link underline" onClick={() => setPreview(c.page + 1)}>View page</button>
              </p>
            </li>
          );
        })}
      </ul>

      {error && <p role="alert" style={{ color: "var(--color-danger)" }}>✗ {error}</p>}
      <div className="btn-row sticky bottom-0 bg-surface py-2">
        <button className="btn btn-primary" disabled={saving || counts.selected === 0} onClick={accept}>
          {saving ? "Adding…" : `Add ${counts.selected} to “${lessonTitle}”`}
        </button>
        <button className="btn btn-secondary" onClick={() => router.push(`/languages/${languageId}/lesson/${lessonId}`)}>Leave without adding</button>
      </div>

      {preview !== null && (
        <Modal title={`Page ${preview} of ${job.filename}`} onClose={() => setPreview(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pageImageUrl(job.id, preview)} alt={`The original page ${preview} of the document`} className="mx-auto max-h-[70vh]" />
        </Modal>
      )}
    </section>
  );
}
