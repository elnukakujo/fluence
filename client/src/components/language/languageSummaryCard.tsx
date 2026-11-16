import Link from "next/link";
import { useTranslations } from "next-intl";
import type { LanguageSummary } from "@/interface/dataCollection/HomeStats";
import LevelMiniBar from "./levelMiniBar";

/** Home card per language: level mini-bar, what the daily review would serve now (LS-24), fading and coverage (never mixed with the average). */
export default function LanguageSummaryCard({ language }: { language: LanguageSummary }) {
    const t = useTranslations("home");
    return (
        <Link href={`/languages/${language.id}`} className="card flex flex-col gap-3 transition hover:-translate-y-0.5 hover:bg-accent-soft hover:shadow-md">
            <h3 className="font-serif text-lg text-ink line-clamp-1">{language.name}</h3>
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
        </Link>
    );
}
