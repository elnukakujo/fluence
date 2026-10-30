"use client";

import { useEffect, useState } from "react";
import { Layers, Merge, Users } from "lucide-react";
import { listInvites, accept, reject } from "@/api/collaboration";
import Modal from "@/components/ui/dialogs/modal";

type Invite = Awaited<ReturnType<typeof listInvites>>[number];
type Mode = "full" | "partial";

const MODES: { value: Mode; title: string; body: string; Icon: typeof Merge }[] = [
  { value: "full", title: "Full sync", Icon: Merge,
    body: "Merge your language into theirs. You both edit one shared course." },
  { value: "partial", title: "Partial sync", Icon: Layers,
    body: "Keep your language separate and pick which of their lessons to share." },
];

export default function Invites() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [accepting, setAccepting] = useState<Invite | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setInvites(await listInvites());
    setLoaded(true);
  }

  useEffect(() => { load(); }, []);

  if (!loaded || invites.length === 0) return null;

  const lessons = accepting?.lessons ?? [];
  const route = (inv: Invite) =>
    inv.source_language && inv.target_language ? `${inv.source_language} → ${inv.target_language}` : null;

  // A partial offer only allows a partial collaboration, so skip the choice.
  const partialOnly = accepting?.proposed_mode === "partial";

  function openAccept(inv: Invite) {
    setAccepting(inv);
    setMode(inv.proposed_mode === "partial" ? "partial" : null);
    setError(null);
    setSelected(new Set((inv.lessons ?? []).map((l) => l.id)));
  }

  function close() {
    if (!busy) setAccepting(null);
  }

  function toggleLesson(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      setAccepting(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const canConfirm = !!mode && (mode === "full" || selected.size > 0);

  return (
    <section className="flex flex-col gap-2" aria-label="Collaboration invites">
      <h2 className="font-serif">Collaboration invites</h2>
      <ul className="flex flex-col gap-2">
        {invites.map((inv) => (
          <li key={inv.id} className="card flex items-center justify-between gap-3">
            <span className="flex items-start gap-3 text-sm">
              <Users size={18} aria-hidden className="mt-0.5 shrink-0 text-accent" />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">
                  {inv.master_name ?? inv.master_id} {inv.lesson_title ? `shared the lesson “${inv.lesson_title}” with you` : "invited you"}
                </span>
                <span className="text-muted">
                  {inv.language_name ?? inv.target_id}{route(inv) && ` · ${route(inv)}`}
                </span>
              </span>
            </span>
            <span className="flex gap-2">
              {inv.target_type === "lesson" ? (
                <button type="button" className="btn btn-primary" onClick={() => run(() => accept(inv.id))}>
                  Accept
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => openAccept(inv)}>
                  Review
                </button>
              )}
              <button type="button" className="btn btn-secondary"
                onClick={() => run(() => reject(inv.id))}>
                Decline
              </button>
            </span>
          </li>
        ))}
      </ul>

      {accepting && (
        <Modal
          title={accepting.language_name ?? accepting.target_id}
          subtitle={`${accepting.master_name ?? accepting.master_id} invited you to collaborate${route(accepting) ? ` · ${route(accepting)}` : ""}`}
          onClose={close}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={close} disabled={busy}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={!canConfirm || busy}
                onClick={() => run(() => mode === "partial"
                  ? accept(accepting.id, "partial", lessons.map((l) => l.id).filter((id) => selected.has(id)))
                  : accept(accepting.id, "full"))}>
                {busy ? "Joining…" : mode === "partial" ? `Share ${selected.size} lesson${selected.size === 1 ? "" : "s"}` : "Join"}
              </button>
            </>
          }
        >
          {partialOnly && (
            <p className="text-sm text-muted">
              {accepting.master_name ?? accepting.master_id} offered {lessons.length} lesson{lessons.length === 1 ? "" : "s"} only.
              Choose which to keep, or take them all.
            </p>
          )}
          {!partialOnly && <div role="radiogroup" aria-label="Sync mode" className="flex flex-col gap-2">
            {MODES.map(({ value, title, body, Icon }) => {
              const active = mode === value;
              return (
                <button key={value} type="button" role="radio" aria-checked={active}
                  onClick={() => setMode(value)}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                    active ? "border-primary bg-accent-soft ring-2 ring-primary" : "border-border hover:bg-accent-soft"}`}>
                  <Icon size={18} aria-hidden className="mt-0.5 shrink-0 text-accent" />
                  <span>
                    <span className="block font-medium">{title}</span>
                    <span className="text-sm text-muted">{body}</span>
                  </span>
                </button>
              );
            })}
          </div>}

          {mode === "full" && (
            <p className="text-xs text-muted">
              If you already study this language pair, the owner must approve the merge before it happens.
            </p>
          )}

          {mode === "partial" && (
            <fieldset className="flex flex-col gap-2">
              <legend className="flex w-full items-center justify-between text-sm font-medium">
                <span>Lessons to share · {selected.size}/{lessons.length}</span>
                <button type="button" className="text-xs text-accent underline"
                  onClick={() => setSelected(new Set(selected.size === lessons.length ? [] : lessons.map((l) => l.id)))}>
                  {selected.size === lessons.length ? "Select none" : "Select all"}
                </button>
              </legend>
              {lessons.length === 0 && <p className="text-sm text-muted">The owner has no lessons yet.</p>}
              <ul className="flex flex-col max-h-56 overflow-y-auto">
                {lessons.map((l) => (
                  <li key={l.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded p-2 text-sm hover:bg-accent-soft">
                      <input type="checkbox" className="mt-1" checked={selected.has(l.id)} onChange={() => toggleLesson(l.id)} />
                      <span className="flex flex-col">
                        <span>{l.title}</span>
                        {l.description && <span className="text-xs text-muted line-clamp-1">{l.description}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}

          {error && <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}
        </Modal>
      )}
    </section>
  );
}
