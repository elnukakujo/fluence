"use client";

import { useEffect, useState } from "react";
import { GitMerge } from "lucide-react";
import { listAwaitingConsent, consent, decline } from "@/api/collaboration";

type Request = Awaited<ReturnType<typeof listAwaitingConsent>>[number];

export default function ConsentRequests() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setRequests(await listAwaitingConsent());
    setLoaded(true);
  }

  useEffect(() => { load(); }, []);

  async function answer(id: string, action: typeof consent) {
    setBusy(id);
    try {
      await action(id);
      await load();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  if (!loaded || requests.length === 0) return null;

  return (
    <section className="flex flex-col gap-2" aria-label="Merge requests">
      <h2 className="font-serif">Merge requests</h2>
      {error && <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}
      <ul className="flex flex-col gap-2">
        {requests.map((r) => (
          <li key={r.id} className="card flex items-center justify-between gap-3">
            <span className="flex items-start gap-3 text-sm">
              <GitMerge size={18} aria-hidden className="mt-0.5 shrink-0 text-accent" />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{r.collaborator_name ?? r.collaborator_id} wants to merge</span>
                <span className="text-muted">
                  Their {r.language_name ?? "language"} would be combined into yours. Their lessons are added to yours.
                </span>
              </span>
            </span>
            <span className="flex gap-2">
              <button type="button" className="btn btn-primary" disabled={busy === r.id} onClick={() => answer(r.id, consent)}>
                Approve merge
              </button>
              <button type="button" className="btn btn-secondary" disabled={busy === r.id} onClick={() => answer(r.id, decline)}>
                Decline
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
