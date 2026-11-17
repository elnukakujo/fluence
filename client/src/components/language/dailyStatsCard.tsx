"use client";

import { useTranslations } from "next-intl";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClock, faFire } from "@fortawesome/free-solid-svg-icons";
import type DailyStats from "@/interface/dataCollection/DailyStats";

/** Today in this language: three figures, then the time studied and the running streak on one line. */
export default function DailyStatsCard({ dailyStats }: { dailyStats: DailyStats }) {
    const t = useTranslations("language");
    const studiedMinutes = Math.round(dailyStats.time_studied_ms / 60000);
    const accuracy = dailyStats.items_reviewed > 0
        ? Math.round((dailyStats.items_correct / dailyStats.items_reviewed) * 100)
        : 0;

    return (
        <section className="card flex flex-col gap-4" aria-labelledby="today-title">
            <header className="flex items-center justify-between gap-3">
                <h2 id="today-title" className="section-title">{t("todayTitle")}</h2>
                <span className={`badge ${dailyStats.streak_day ? "badge-ok" : ""}`}>{dailyStats.streak_day ? t("streakDay") : t("buildingStreak")}</span>
            </header>
            <ul className="grid list-none grid-cols-3 gap-3 pl-0">
                <li className="figure"><b>{dailyStats.items_reviewed}</b><span>{t("reviewed")}</span></li>
                <li className="figure"><b>{dailyStats.items_correct}</b><span>{t("correct")}</span></li>
                <li className="figure"><b>{accuracy}%</b><span>{t("accuracy")}</span></li>
            </ul>
            <p className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-dashed border-border pt-3 text-sm text-muted">
                <span className="inline-flex items-center gap-2"><FontAwesomeIcon icon={faClock} className="size-4 text-accent" aria-hidden />{t("studyTime")} <strong className="text-ink">{studiedMinutes} min</strong></span>
                <span className="inline-flex items-center gap-2"><FontAwesomeIcon icon={faFire} className="size-4 text-accent" aria-hidden />{t("currentStreak")} <strong className="text-ink">{dailyStats.current_streak_length}</strong></span>
            </p>
        </section>
    );
}
