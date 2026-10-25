"use client";

import { useEffect, useState } from "react";
import { getAllUsers, deleteUser, setUserBlocked } from "@/api/user";
import SectionCard from "./sectionCard";
import RoleBadge from "./roleBadge";
import ConfirmDialog from "./confirmDialog";
import type User from "@/interface/systemData/User";

export default function UsersSection({ currentUserId }: { currentUserId: string }) {
    const [users, setUsers] = useState<User[]>([]);
    const [deleting, setDeleting] = useState<string | null>(null);

    const refresh = async () => {
        const data = await getAllUsers();
        setUsers(Array.isArray(data) ? data : []);
    };

    useEffect(() => { refresh(); }, []);

    const handleToggleBlock = async (userId: string, blocked: boolean) => {
        await setUserBlocked(userId, blocked);
        await refresh();
    };

    const handleDelete = async () => {
        if (!deleting) return;
        await deleteUser(deleting);
        setDeleting(null);
        await refresh();
    };

    return (
        <SectionCard title="Users">
            <p className="text-sm opacity-60">Manage family accounts.</p>
            <div className="flex flex-col gap-2">
                {users.map((u) => (
                    <div key={u.id} className="card flex items-center justify-between gap-3 p-3">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className="font-medium">{u.display_name || u.username}</span>
                                <RoleBadge isAdmin={u.is_admin} blocked={u.blocked} />
                            </div>
                            <span className="text-xs text-muted">{u.email}</span>
                            <span className="text-xs text-muted">
                                Last login: {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "never"}
                            </span>
                        </div>
                        {u.id !== currentUserId && (
                            <div className="flex shrink-0 items-center gap-2">
                                <button
                                    type="button"
                                    className="btn btn-secondary text-sm"
                                    onClick={() => handleToggleBlock(u.id!, !u.blocked)}
                                >
                                    {u.blocked ? "Unblock" : "Block"}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-danger text-sm"
                                    onClick={() => setDeleting(u.id!)}
                                >
                                    Delete
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {deleting && (
                <ConfirmDialog
                    message="Delete this user and all their content? This cannot be undone."
                    confirmLabel="Delete"
                    danger
                    onConfirm={handleDelete}
                    onCancel={() => setDeleting(null)}
                />
            )}
        </SectionCard>
    );
}
