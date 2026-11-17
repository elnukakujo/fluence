"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import presets from "@/shared/presets.json";
import { applyPreset } from "@/api/settings";
import InlineError from "@/components/ui/inlineError";

/** Casual / Standard / Intensive: pace only (new per week, reviews per day, streak minimum). One tap applies it; each shows its three numbers. */
export default function PresetPicker({ onApplied }: { onApplied?: () => void }) {
    const t = useTranslations("settingsGroups.presets");
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState("");

    const apply = async (name: string) => {
        setBusy(name); setError("");
        try { await applyPreset(name); onApplied?.(); } catch { setError(t("failed")); } finally { setBusy(null); }
    };

    return (
        <div role="group" aria-label={t("title")} className="flex flex-col gap-2">
            <p className="text-sm text-muted">{t("description")}</p>
            {error && <InlineError>{error}</InlineError>}
            <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 pl-0 sm:grid-cols-3">
                {Object.entries(presets).map(([name, p]) => (
                    <li key={name}>
                        <button type="button" disabled={busy !== null} onClick={() => apply(name)} aria-label={t("applyNamed", { name: t(name) })}
                            className="flex min-h-11 w-full flex-col items-start gap-0.5 rounded-xl border border-border bg-surface px-3 py-2 text-left transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:opacity-50">
                            <strong className="text-sm">{t(name)}</strong>
                            <span className="text-xs text-muted">{t("newPerWeek", { n: p.new_per_week })}</span>
                            <span className="text-xs text-muted">{t("reviewsPerDay", { n: p.reviews_per_day })}</span>
                            <span className="text-xs text-muted">{t("streakMin", { n: p.streak_min_answers })}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
