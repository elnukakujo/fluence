import { useTranslations } from "next-intl";
import type { LanguageSummary } from "@/interface/dataCollection/HomeStats";
import LevelMiniBar from "./levelMiniBar";

/** The numbers of one language on the home card: level mini-bar, what the daily review would serve now (LS-24), fading and
 *  coverage (never mixed with the average). The card around it is `LanguageOverviewCard`. */
export default function LanguageSummaryCard({ language }: { language: LanguageSummary }) {
    const t = useTranslations("home");
    return (
        <div className="flex flex-col gap-3">
            <LevelMiniBar {...language.levels} />
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted">
                <dt>{t("due")}</dt>
                <dd className="text-ink">{t("dueValue", { count: language.due, minutes: language.due_minutes })}</dd>
                <dt>{t("fading")}</dt>
                <dd className="text-ink">{language.fading}</dd>
                <dt>{t("coverage")}</dt>
                <dd className="text-ink">{Math.round(language.coverage * 100)}%</dd>
                <dt>{t("meanSeen")}</dt>
                <dd className="text-ink">{language.mean_seen === null ? "–" : Math.round(language.mean_seen)}</dd>
                <dt>{t("minutesToday")}</dt>
                <dd className="text-ink">{language.minutes_today}</dd>
            </dl>
        </div>
    );
}
