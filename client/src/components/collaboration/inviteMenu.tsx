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

  async function load() {
    const [allUsers, collabs] = await Promise.all([
      listUsers(),
      listCollaborators(targetType, targetId),
    ]);
    setUsers(allUsers);
    const map: Record<string, string> = {};
    for (const c of collabs) map[c.collaborator_id] = c.id;
    setCollaborators(map);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [targetType, targetId]);

  async function handleInvite(userId: string) {
    await invite(userId, targetType, targetId);
    await load();
  }

  async function handleRemove(userId: string) {
    const collabId = collaborators[userId];
    if (!collabId) return;
    await remove(collabId);
    await load();
  }

  return (
    <div className="card flex flex-col gap-2">
      <h4 className="font-serif">Collaborators</h4>
      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <ul className="flex flex-col gap-1 max-h-64 overflow-y-auto">
          {users.map((u) => {
            const isCollaborator = u.id in collaborators;
            return (
              <li key={u.id} className="flex items-center justify-between gap-2">
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
      <button type="button" className="btn" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
