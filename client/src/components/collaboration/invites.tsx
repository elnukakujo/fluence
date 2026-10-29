"use client";

import { useEffect, useState } from "react";
import { listInvites, accept, reject } from "@/api/collaboration";
import { createPortal } from "react-dom";

type Invite = {
  id: string;
  master_id: string;
  master_name?: string;
  target_type: string;
  target_id: string;
  language_name?: string;
  source_language?: string;
  target_language?: string;
  lessons?: { id: string; title: string }[];
};

export default function Invites() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selecting, setSelecting] = useState<Invite | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function load() {
    setInvites(await listInvites());
    setLoaded(true);
  }

  useEffect(() => { load(); }, []);

  if (!loaded || invites.length === 0) return null;

  function toggleLesson(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function confirmPartial() {
    if (!selecting) return;
    const ids = selecting.lessons?.map((l) => l.id).filter((id) => selected.has(id));
    await accept(selecting.id, "partial", ids);
    setSelecting(null);
    setSelected(new Set());
    await load();
  }

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
                onClick={() => { setSelecting(inv); setSelected(new Set((inv.lessons ?? []).map((l) => l.id))); }}
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

      {selecting && createPortal(
        <div className="fixed inset-0 z-50 flex flex-col gap-3 items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card flex flex-col gap-3 max-w-md w-full">
            <p className="font-medium">Choose lessons to share</p>
            <ul className="flex flex-col gap-1 max-h-64 overflow-y-auto">
              {(selecting.lessons ?? []).map((l) => (
                <li key={l.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.has(l.id)}
                    onChange={() => toggleLesson(l.id)}
                  />
                  <span>{l.title}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-row gap-2 justify-end">
              <button type="button" className="btn btn-primary" onClick={confirmPartial}>
                Share selected
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => { setSelecting(null); setSelected(new Set()); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
