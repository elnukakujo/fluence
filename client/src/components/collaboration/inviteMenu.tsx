"use client";

import { useEffect, useState } from "react";
import { listUsers, listCollaborators, invite, remove } from "@/api/collaboration";

export default function InviteMenu({ targetType, targetId, onClose }: {
  targetType: "language" | "lesson";
  targetId: string;
  onClose: () => void;
}) {
  const [users, setUsers] = useState<{ id: string; display_name: string }[]>([]);
  const [collaborators, setCollaborators] = useState<Record<string, string>>({});  // collaborator_id -> collab id
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [allUsers, collabs] = await Promise.all([
        listUsers(),
        listCollaborators(targetType, targetId),
      ]);
      setUsers(allUsers);
      const map: Record<string, string> = {};
      for (const c of collabs) map[c.collaborator_id] = c.id;
      setCollaborators(map);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [targetType, targetId]);

  async function handleInvite(userId: string) {
    try {
      await invite(userId, targetType, targetId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to invite");
    }
  }

  async function handleRemove(userId: string) {
    const collabId = collaborators[userId];
    if (!collabId) return;
    try {
      await remove(collabId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove");
    }
  }

  return (
    <div className="card w-full max-w-sm flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-serif">Collaborators</h3>
        <button type="button" onClick={onClose} className="btn btn-secondary">
          Close
        </button>
      </div>
      {error && <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}
      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted">No other users yet.</p>
      ) : (
        <ul className="flex flex-col gap-1 max-h-72 overflow-y-auto">
          {users.map((u) => {
            const isCollaborator = u.id in collaborators;
            return (
              <li key={u.id} className="flex items-center justify-between gap-2 py-1">
                <span className="text-sm">{u.display_name}</span>
                {isCollaborator ? (
                  <button type="button" className="btn btn-secondary" onClick={() => handleRemove(u.id)}>
                    Remove
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={() => handleInvite(u.id)}>
                    Invite
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
