"use client";

import { useEffect, useState } from "react";
import { listInvites, accept, reject } from "@/api/collaboration";

type Invite = {
  id: string;
  master_id: string;
  master_name?: string;
  target_type: string;
  target_id: string;
  language_name?: string;
  source_language?: string;
  target_language?: string;
};

export default function Invites() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const invs = await listInvites();
    setInvites(invs);
    setLoaded(true);
  }

  useEffect(() => {
    load();
  }, []);

  if (!loaded || invites.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-serif">Collaboration invites</h2>
      <ul className="flex flex-col gap-2">
        {invites.map((inv) => (
          <li key={inv.id} className="card flex items-center justify-between gap-2">
            <span className="text-sm flex flex-col gap-0.5">
              <span className="font-medium">{inv.master_name ?? inv.master_id} invited you</span>
              <span className="text-muted">
                {inv.language_name ?? inv.target_id}
                {inv.source_language && inv.target_language && (
                  <> ({inv.source_language} → {inv.target_language})</>
                )}
              </span>
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => { await accept(inv.id, "full"); await load(); }}
              >
                Accept (full)
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={async () => { await accept(inv.id, "partial"); await load(); }}
              >
                Accept (partial)
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={async () => { await reject(inv.id); await load(); }}
              >
                Reject
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
