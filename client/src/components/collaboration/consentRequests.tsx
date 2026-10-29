"use client";

import { useEffect, useState } from "react";
import { listAwaitingConsent, consent } from "@/api/collaboration";

type Request = { id: string; collaborator_id: string; target_id: string; target_type: string; mode: string };

export default function ConsentRequests() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    setRequests(await listAwaitingConsent());
    setLoaded(true);
  }

  useEffect(() => { load(); }, []);

  if (!loaded || requests.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-serif">Pending full-sync requests</h2>
      <ul className="flex flex-col gap-2">
        {requests.map((r) => (
          <li key={r.id} className="card flex items-center justify-between gap-2">
            <span className="text-sm">
              {r.collaborator_id} wants to merge into your language
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => { await consent(r.id); await load(); }}
              >
                Accept merge
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
