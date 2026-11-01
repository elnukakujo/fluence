"use client";

import { useTranslations } from "next-intl";

export default function MissingContentNotice() {
    const t = useTranslations("exercises");
    return (
        <div className="card border-danger/30 bg-danger/10 text-danger">
            <p>{t("exercisesMissing")}</p>
        </div>
    );
}
