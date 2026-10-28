"use client";

import { useEffect, useState } from "react";
import { listInvites, accept, reject } from "@/api/collaboration";

export default function Invites() {
  const [invites, setInvites] = useState<{ id: string; master_id: string; target_type: string; target_id: string }[]>([]);
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
            <span className="text-sm">
              {inv.target_type === "language" ? "Language" : "Lesson"}: {inv.target_id}
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => { await accept(inv.id); await load(); }}
              >
                Accept
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
