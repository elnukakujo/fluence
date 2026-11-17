"use client";

import { useTranslations } from "next-intl";
import presets from "@/shared/presets.json";

/** Casual / Standard / Intensive: pace only (new per week, reviews per day, streak minimum). A tap only fills the form with its three numbers;
 *  nothing changes (goals included) until the user presses Save. */
export default function PresetPicker({ onPick }: { onPick: (values: Record<string, number>) => void }) {
    const t = useTranslations("settingsGroups.presets");
    return (
        <div role="group" aria-label={t("title")} className="flex flex-col gap-2">
            <p className="text-sm text-muted">{t("description")}</p>
            <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 pl-0 sm:grid-cols-3">
                {Object.entries(presets).map(([name, p]) => (
                    <li key={name}>
                        <button type="button" onClick={() => onPick(p)} aria-label={t("applyNamed", { name: t(name) })}
                            className="flex min-h-11 w-full flex-col items-start gap-0.5 rounded-xl border border-border bg-surface px-3 py-2 text-left transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">
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
