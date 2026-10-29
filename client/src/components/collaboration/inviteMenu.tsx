"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { listUsers, listCollaborators, invite, remove } from "@/api/collaboration";
import ConfirmDialog from "@/components/user/confirmDialog";

type Collab = { id: string; status: string; mode?: string | null };
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

  async function load() {
    try {
      const [allUsers, collabs] = await Promise.all([listUsers(), listCollaborators(targetType, targetId)]);
      setUsers(allUsers);
      setCollaborators(Object.fromEntries(collabs.map((c) => [c.collaborator_id, c])));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [targetType, targetId]);

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
                    <button type="button" className="btn btn-primary" disabled={disabled}
                      onClick={() => run(u.id, () => invite(u.id, targetType, targetId), "Failed to invite")}>
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
            collaborators[removing.id]?.mode === "partial"
              ? "They lose access to your shared lessons."
              : "They keep a copy of the content in their own account."}`}
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const target = removing;
            setRemoving(null);
            run(target.id, () => remove(collaborators[target.id].id), "Failed to remove");
          }}
        />
      )}
    </>
  );
}
