"use client";

import { useTranslations } from "next-intl";
import presets from "@/shared/presets.json";
import { scaled, type Period } from "@/utils/goalSplit";

export type Pace = { new_per_week: number; reviews_per_day: number; streak_min_answers: number };

/** Casual / Standard / Intensive for the chosen period: a tap only fills the goal form below (and the streak minimum); nothing is saved until the goal is locked. */
export default function PresetPicker({ onPick, isSelected, period }: { onPick: (values: Pace) => void; isSelected: (p: Pace) => boolean; period: Period }) {
    const t = useTranslations("settingsGroups.presets");
    return (
        <div role="group" aria-label={t("title")} className="flex flex-col gap-2">
            <p className="text-sm text-muted">{t("description")}</p>
            <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 pl-0 sm:grid-cols-3">
                {Object.entries(presets).map(([name, p]) => {
                    const selected = isSelected(p);   // only while the form still holds this preset's numbers
                    return (
                    <li key={name}>
                        <button type="button" onClick={() => onPick(p)} aria-pressed={selected} aria-label={t("applyNamed", { name: t(name) })}
                            className={`flex min-h-11 w-full flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition-colors hover:bg-accent-soft ${selected ? "border-[var(--color-accent)] bg-accent-soft" : "border-border bg-surface"} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]`}>
                            <strong className="text-sm">{t(name)}</strong>
                            <span className="text-xs text-muted">{t("newPerPeriod", { n: scaled(p.new_per_week, period) })}</span>
                            <span className="text-xs text-muted">{t("reviewsPerPeriod", { n: scaled(p.reviews_per_day, period) })}</span>
                            <span className="text-xs text-muted">{t("streakMin", { n: p.streak_min_answers })}</span>
                        </button>
                    </li>
                    );
                })}
            </ul>
        </div>
    );
}
