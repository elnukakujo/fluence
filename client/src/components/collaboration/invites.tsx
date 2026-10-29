"use client";

import { useEffect, useState } from "react";
import { listInvites, accept, reject } from "@/api/collaboration";
import { createPortal } from "react-dom";

type LessonInfo = { id: string; title: string; description?: string; level?: number };
type Invite = {
  id: string;
  master_id: string;
  master_name?: string;
  target_type: string;
  target_id: string;
  language_name?: string;
  source_language?: string;
  target_language?: string;
  lessons?: LessonInfo[];
};

export default function Invites() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [accepting, setAccepting] = useState<Invite | null>(null);
  const [mode, setMode] = useState<"full" | "partial" | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function load() {
    setInvites(await listInvites());
    setLoaded(true);
  }

  useEffect(() => { load(); }, []);

  if (!loaded || invites.length === 0) return null;

  function openAccept(inv: Invite) {
    setAccepting(inv);
    setMode(null);
    setSelected(new Set((inv.lessons ?? []).map((l) => l.id)));
  }

  function toggleLesson(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function confirm() {
    if (!accepting || !mode) return;
    if (mode === "partial") {
      const ids = (accepting.lessons ?? []).map((l) => l.id).filter((id) => selected.has(id));
      await accept(accepting.id, "partial", ids);
    } else {
      await accept(accepting.id, "full");
    }
    setAccepting(null);
    setMode(null);
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
              <button type="button" className="btn btn-primary" onClick={() => openAccept(inv)}>
                Accept
              </button>
              <button type="button" className="btn btn-secondary" onClick={async () => { await reject(inv.id); await load(); }}>
                Reject
              </button>
            </span>
          </li>
        ))}
      </ul>

      {accepting && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card flex flex-col gap-4 max-w-lg w-full p-5" role="dialog" aria-modal="true">
            <div className="flex flex-col gap-0.5">
              <h3 className="font-serif text-lg">{accepting.language_name ?? accepting.target_id}</h3>
              <p className="text-sm text-muted">
                {accepting.master_name ?? accepting.master_id} invited you to collaborate
                {accepting.source_language && accepting.target_language && (
                  <> · {accepting.source_language} → {accepting.target_language}</>
                )}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                className={`card text-left p-3 border transition ${mode === "full" ? "border-ink ring-2 ring-ink" : "hover:bg-accent-soft"}`}
                onClick={() => setMode("full")}
              >
                <span className="font-medium block">Full sync</span>
                <span className="text-sm text-muted">
                  Merge your language into theirs — you both edit one shared course.
                </span>
              </button>
              <button
                type="button"
                className={`card text-left p-3 border transition ${mode === "partial" ? "border-ink ring-2 ring-ink" : "hover:bg-accent-soft"}`}
                onClick={() => setMode("partial")}
              >
                <span className="font-medium block">Partial sync</span>
                <span className="text-sm text-muted">
                  Keep your language separate — pick which of their lessons to share.
                </span>
              </button>
            </div>

            {mode === "partial" && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Choose lessons to share</p>
                <ul className="flex flex-col gap-1 max-h-56 overflow-y-auto">
                  {(accepting.lessons ?? []).map((l) => (
                    <li
                      key={l.id}
                      className="flex items-start gap-2 text-sm p-2 rounded hover:bg-accent-soft"
                      title={l.description || l.title}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(l.id)}
                        onChange={() => toggleLesson(l.id)}
                      />
                      <span className="flex flex-col">
                        <span>{l.title}</span>
                        {l.description && (
                          <span className="text-xs text-muted line-clamp-1">{l.description}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-row gap-2 justify-end">
              <button type="button" className="btn btn-primary" onClick={confirm} disabled={!mode}>
                Confirm
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => { setAccepting(null); setMode(null); }}>
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
