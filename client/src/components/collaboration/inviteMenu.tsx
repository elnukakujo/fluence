"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { listUsers, listCollaborators, invite, remove, listLessonRecipients, unshareLesson, listLanguageLessons } from "@/api/collaboration";
import ConfirmDialog from "@/components/user/confirmDialog";

// `shared` = a lesson recipient (access is the share itself, there is no collaboration row to cancel)
type Collab = { id: string; status: string; mode?: string | null; shared?: boolean };
type User = { id: string; display_name: string };

const STATUS: Record<string, { label: string; tone: string }> = {
  accepted: { label: "Collaborating", tone: "var(--color-success)" },
  pending: { label: "Invite sent", tone: "var(--color-warning)" },
  awaiting_master_consent: { label: "Awaiting your approval", tone: "var(--color-warning)" },
};

function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent font-medium">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

export default function InviteMenu({ targetType, targetId }: {
  targetType: "language" | "lesson";
  targetId: string;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [collaborators, setCollaborators] = useState<Record<string, Collab>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [removing, setRemoving] = useState<User | null>(null);
  const [offerMode, setOfferMode] = useState<"full" | "partial">("full");
  const [lessons, setLessons] = useState<{ id: string; title: string }[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  async function load() {
    try {
      const [allUsers, collabs, recipients] = await Promise.all([
        listUsers(), listCollaborators(targetType, targetId),
        targetType === "lesson" ? listLessonRecipients(targetId) : Promise.resolve([]),
      ]);
      setUsers(allUsers);
      setCollaborators({
        ...Object.fromEntries(collabs.map((c) => [c.collaborator_id, c as Collab])),
        ...Object.fromEntries(recipients.map((r) => [r.user_id, { id: "", status: "accepted", shared: true } as Collab])),
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [targetType, targetId]);

  useEffect(() => {
    if (targetType !== "language") return;
    listLanguageLessons(targetId).then((ls) => setLessons(ls)).catch(() => setLessons([]));
  }, [targetType, targetId]);

  const offer = targetType === "language"
    ? { mode: offerMode, lessonIds: lessons.map((l) => l.id).filter((id) => picked.has(id)) } : undefined;
  const offerInvalid = offerMode === "partial" && picked.size === 0 && targetType === "language";

  async function run(userId: string, action: () => Promise<unknown>, fallback: string) {
    setBusy(userId);
    try {
      await action();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : fallback);
    } finally {
      setBusy(null);
    }
  }

  // collaborators first, then everyone else alphabetically
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter((u) => u.display_name.toLowerCase().includes(q))
      .sort((a, b) =>
        Number(!!collaborators[b.id]) - Number(!!collaborators[a.id]) ||
        a.display_name.localeCompare(b.display_name));
  }, [users, collaborators, query]);

  if (loading) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <>
      {error && <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}
      {users.length === 0 ? (
        <p className="text-sm text-muted">No other users yet.</p>
      ) : (
        <>
          {users.length > 6 && (
            <label className="relative block">
              <Search size={14} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input className="input !pl-8" placeholder="Search people" aria-label="Search people"
                value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          )}
          {targetType === "language" && (
            <fieldset className="flex flex-col gap-2 rounded-xl border border-border p-3">
              <legend className="px-1 text-sm font-medium">What to offer</legend>
              <div role="radiogroup" aria-label="Offer" className="flex gap-4 text-sm">
                {(["full", "partial"] as const).map((m) => (
                  <label key={m} className="flex items-center gap-2">
                    <input type="radio" name="offer" checked={offerMode === m} onChange={() => setOfferMode(m)} />
                    {m === "full" ? "Whole language" : "Some lessons"}
                  </label>
                ))}
              </div>
              {offerMode === "partial" && (
                <ul className="flex max-h-40 flex-col overflow-y-auto">
                  {lessons.length === 0 && <li className="text-sm text-muted">No lessons yet.</li>}
                  {lessons.map((l) => (
                    <li key={l.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded p-1 text-sm hover:bg-accent-soft">
                        <input type="checkbox" checked={picked.has(l.id)}
                          onChange={() => setPicked((prev) => { const n = new Set(prev); if (!n.delete(l.id)) n.add(l.id); return n; })} />
                        {l.title}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          )}
          <ul className="flex flex-col divide-y divide-border">
            {visible.map((u) => {
              const collab = collaborators[u.id];
              const status = collab && STATUS[collab.status];
              const disabled = busy === u.id;
              return (
                <li key={u.id} className="flex items-center gap-3 py-2">
                  <Avatar name={u.display_name} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{u.display_name}</span>
                    {status && (
                      <span className="text-xs" style={{ color: status.tone }}>
                        {status.label}
                        {collab.status === "accepted" && collab.mode && ` · ${collab.mode === "partial" ? "Partial" : "Full"} sync`}
                      </span>
                    )}
                  </span>
                  {!collab ? (
                    <button type="button" className="btn btn-primary" disabled={disabled || offerInvalid}
                      onClick={() => run(u.id, () => invite(u.id, targetType, targetId, offer), "Failed to invite")}>
                      Invite
                    </button>
                  ) : collab.status === "pending" ? (
                    <button type="button" className="btn btn-secondary" disabled={disabled}
                      onClick={() => run(u.id, () => remove(collab.id), "Failed to cancel invite")}>
                      Cancel invite
                    </button>
                  ) : collab.status === "accepted" ? (
                    <button type="button" className="btn btn-secondary" disabled={disabled}
                      onClick={() => setRemoving(u)}>
                      Remove
                    </button>
                  ) : null}
                </li>
              );
            })}
            {visible.length === 0 && <li className="py-3 text-sm text-muted">No one matches “{query}”.</li>}
          </ul>
        </>
      )}
      {removing && (
        <ConfirmDialog
          danger
          confirmLabel="Remove"
          message={`Remove ${removing.display_name}? ${
            collaborators[removing.id]?.mode === "partial" || collaborators[removing.id]?.shared
              ? "They lose access to your shared lessons."
              : "They keep a copy of the content in their own account."}`}
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const target = removing;
            setRemoving(null);
            const c = collaborators[target.id];
            run(target.id, () => c.shared ? unshareLesson(targetId, target.id) : remove(c.id), "Failed to remove");
          }}
        />
      )}
    </>
  );
}
