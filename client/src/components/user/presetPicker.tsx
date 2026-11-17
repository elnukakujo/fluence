"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import presets from "@/shared/presets.json";
import { applyPreset } from "@/api/settings";
import InlineError from "@/components/ui/inlineError";

/** Casual / Standard / Intensive: pace only (new per week, reviews per day, streak minimum). Each shows its three numbers. */
export default function PresetPicker({ onApplied }: { onApplied?: () => void }) {
    const t = useTranslations("settingsGroups.presets");
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState("");

    const apply = async (name: string) => {
        setBusy(name); setError("");
        try { await applyPreset(name); onApplied?.(); } catch { setError(t("failed")); } finally { setBusy(null); }
    };

    return (
        <div className="flex flex-col gap-2">
            <h3>{t("title")}</h3>
            <p className="text-sm text-muted">{t("description")}</p>
            {error && <InlineError>{error}</InlineError>}
            <ul className="grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-3">
                {Object.entries(presets).map(([name, p]) => (
                    <li key={name} className="card flex flex-col gap-1">
                        <strong>{t(name)}</strong>
                        <span className="text-sm">{t("newPerWeek", { n: p.new_per_week })}</span>
                        <span className="text-sm">{t("reviewsPerDay", { n: p.reviews_per_day })}</span>
                        <span className="text-sm">{t("streakMin", { n: p.streak_min_answers })}</span>
                        <button type="button" className="btn btn-secondary min-h-11" disabled={busy !== null} onClick={() => apply(name)}>{t("apply")}</button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
