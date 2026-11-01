"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getAllUsers, deleteUser, setUserBlocked, setUserApproved } from "@/api/user";
import SectionCard from "./sectionCard";
import RoleBadge from "./roleBadge";
import ConfirmDialog from "./confirmDialog";
import type User from "@/interface/systemData/User";

export default function UsersSection({ currentUserId }: { currentUserId: string }) {
    const t = useTranslations("settingsAdmin.users");
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

    const handleApprove = async (userId: string) => {
        await setUserApproved(userId, true);
        await refresh();
    };

    const handleDelete = async () => {
        if (!deleting) return;
        await deleteUser(deleting);
        setDeleting(null);
        await refresh();
    };

    return (
        <SectionCard title={t("title")}>
            <p className="text-sm opacity-60">{t("description")}</p>
            <div className="flex flex-col gap-2">
                {users.map((u) => (
                    <div key={u.id} className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{u.display_name || u.username}</span>
                                <RoleBadge isAdmin={u.is_admin} approved={u.approved} blocked={u.blocked} />
                            </div>
                            <span className="break-all text-xs text-muted">{u.email}</span>
                            <span className="text-xs text-muted">
                                {t("lastLogin", { date: u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : t("neverLoggedIn") })}
                            </span>
                        </div>
                        {u.id !== currentUserId && (
                            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                                {!u.approved && (
                                    <button
                                        type="button"
                                        className="btn btn-primary text-sm"
                                        onClick={() => handleApprove(u.id!)}
                                    >
                                        {t("approve")}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="btn btn-secondary text-sm"
                                    onClick={() => handleToggleBlock(u.id!, !u.blocked)}
                                >
                                    {u.blocked ? t("unblock") : (u.approved ? t("block") : t("reject"))}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-danger text-sm"
                                    onClick={() => setDeleting(u.id!)}
                                >
                                    {t("delete")}
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {deleting && (
                <ConfirmDialog
                    message={t("deleteConfirm")}
                    confirmLabel={t("delete")}
                    danger
                    onConfirm={handleDelete}
                    onCancel={() => setDeleting(null)}
                />
            )}
        </SectionCard>
    );
}
