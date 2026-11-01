"use client";

import { useTranslations } from "next-intl";

export default function RoleBadge({ isAdmin, approved, blocked }: { isAdmin?: boolean; approved?: boolean; blocked?: boolean }) {
    const t = useTranslations("settingsAdmin.users.roleBadges");
    if (blocked) {
        return <span className="badge whitespace-nowrap bg-danger/15 text-danger">{t("blocked")}</span>;
    }
    if (approved === false) {
        return <span className="badge whitespace-nowrap bg-warning/15 text-warning">{t("pending")}</span>;
    }
    if (isAdmin) {
        return <span className="badge whitespace-nowrap bg-accent text-primary-foreground">{t("admin")}</span>;
    }
    return <span className="badge whitespace-nowrap">{t("user")}</span>;
}
