"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import SectionCard from "@/components/ui/sectionCard";
import ConfirmDialog from "@/components/ui/dialogs/confirmDialog";
import EmptyState from "@/components/ui/emptyState";
import InlineError from "@/components/ui/inlineError";
import { deleteJob, listJobs, Job } from "@/api/ingestion";

/** "My uploads": the documents the learner imported, each deletable (file, parse cache and job go together). */
export default function UploadsSection() {
  const t = useTranslations("settings.uploads");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [pending, setPending] = useState<Job | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listJobs().then(setJobs).catch((e) => setError(e instanceof Error ? e.message : t("failedLoad")));
  }, [t]);

  const confirm = async () => {
    if (!pending) return;
    try {
      await deleteJob(pending.id);
      setJobs((all) => all.filter((j) => j.id !== pending.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("failedDelete"));
    }
    setPending(null);
  };

  return (
    <SectionCard title={t("title")} fold>
      <p className="text-sm opacity-70">{t("description")}</p>
      {error && <InlineError>{error}</InlineError>}
      {jobs.length === 0 ? (
        <EmptyState>{t("empty")}</EmptyState>
      ) : (
        <ul className="list-none pl-0 flex flex-col gap-2">
          {jobs.map((job) => (
            <li key={job.id} className="flex items-center justify-between gap-3">
              <span className="truncate">{job.filename}</span>
              <button type="button" className="btn btn-secondary min-h-11 min-w-11" onClick={() => setPending(job)}>{t("delete")}</button>
            </li>
          ))}
        </ul>
      )}
      {pending && (
        <ConfirmDialog
          message={t("confirm", { name: pending.filename })}
          confirmLabel={t("delete")}
          danger
          onConfirm={confirm}
          onCancel={() => setPending(null)}
        />
      )}
    </SectionCard>
  );
}
