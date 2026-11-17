import { useTranslations } from "next-intl";
import type { LanguageSummary } from "@/interface/dataCollection/HomeStats";
import LevelMiniBar from "./levelMiniBar";

/** The numbers of one language: the three levels as big figures over a bar, what the daily review would serve now (LS-24) as the
 *  highlighted row, then fading and coverage (never mixed with the average of seen). The card around it is `LanguageOverviewCard`. */
export default function LanguageSummaryCard({ language }: { language: LanguageSummary }) {
    const t = useTranslations("home");
    return (
        <div className="flex flex-col gap-4">
            <LevelMiniBar {...language.levels} large />
            <dl className="flex flex-col gap-3 text-xs text-muted">
                <div className="flex items-baseline justify-between gap-3 rounded-lg bg-accent-soft px-3 py-2">
                    <dt className="font-medium text-ink">{t("due")}</dt>
                    <dd className="text-sm font-semibold text-ink">{t("dueValue", { count: language.due, minutes: language.due_minutes })}</dd>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <Small label={t("fading")} value={String(language.fading)} />
                    <Small label={t("coverage")} value={`${Math.round(language.coverage * 100)}%`} />
                    <Small label={t("meanSeen")} value={language.mean_seen === null ? "–" : String(Math.round(language.mean_seen))} />
                    <Small label={t("minutesToday")} value={String(language.minutes_today)} />
                </div>
            </dl>
        </div>
    );
}

function Small({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-2 border-b border-dashed border-border pb-1">
            <dt>{label}</dt>
            <dd className="font-medium text-ink">{value}</dd>
        </div>
    );
}
