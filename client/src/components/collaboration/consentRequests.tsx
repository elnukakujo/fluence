"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { GitMerge } from "lucide-react";
import { listAwaitingConsent, consent, decline, type MergeChoice, type MergeConflict } from "@/api/collaboration";
import { ApiError } from "@/api/apiFetch";
import MergeConflictsDialog from "./mergeConflictsDialog";
import InlineError from "@/components/ui/inlineError";

type Request = Awaited<ReturnType<typeof listAwaitingConsent>>[number];

export default function ConsentRequests() {
  const t = useTranslations("collaboration");
  const [requests, setRequests] = useState<Request[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ id: string; conflicts: MergeConflict[] } | null>(null);

  async function load() {
    setRequests(await listAwaitingConsent());
    setLoaded(true);
  }

  useEffect(() => { load(); }, []);

  async function answer(id: string, action: typeof consent, decisions?: Record<string, MergeChoice>) {
    setBusy(id);
    try {
      await action(id, decisions);
      setAsking(null);
      await load();
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && Array.isArray(e.body?.conflicts)) {
        setAsking({ id, conflicts: e.body.conflicts as MergeConflict[] });      // the owner decides each conflicting item
        return;
      }
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  if (!loaded || requests.length === 0) return null;

  return (
    <section className="flex flex-col gap-2" aria-label={t("mergeRequests")}>
      <h2 className="font-serif">{t("mergeRequests")}</h2>
      {error && <InlineError>{error}</InlineError>}
      {asking && <MergeConflictsDialog conflicts={asking.conflicts} onCancel={() => setAsking(null)} onConfirm={(d) => answer(asking.id, consent, d)} />}
      <ul className="flex flex-col gap-2">
        {requests.map((r) => (
          <li key={r.id} className="card flex items-center justify-between gap-3">
            <span className="flex items-start gap-3 text-sm">
              <GitMerge size={18} aria-hidden className="mt-0.5 shrink-0 text-accent" />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{r.collaborator_name ?? r.collaborator_id} {t("wantsToMerge")}</span>
                <span className="text-muted">
                  {t("mergeDescription", { language: r.language_name ?? "language" })}
                </span>
              </span>
            </span>
            <span className="flex gap-2">
              <button type="button" className="btn btn-primary" disabled={busy === r.id} onClick={() => answer(r.id, consent)}>
                {t("approveMerge")}
              </button>
              <button type="button" className="btn btn-secondary" disabled={busy === r.id} onClick={() => answer(r.id, decline)}>
                {t("decline")}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
