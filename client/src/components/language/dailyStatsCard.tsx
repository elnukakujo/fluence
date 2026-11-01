"use client";

import { useTranslations } from "next-intl";
import type DailyStats from "@/interface/dataCollection/DailyStats";

export default function DailyStatsCard({ dailyStats }: { dailyStats: DailyStats }) {
    const t = useTranslations("language");
    const studiedMinutes = Math.round(dailyStats.time_studied_ms / 60000);
    const accuracy = dailyStats.items_reviewed > 0
        ? Math.round((dailyStats.items_correct / dailyStats.items_reviewed) * 100)
        : 0;

    return (
        <section className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between gap-4">
                <h4 className="font-serif text-base text-ink">{t("dailyStats")}</h4>
                <span className="text-xs text-muted">{dailyStats.streak_day ? t("streakDay") : t("buildingStreak")}</span>
            </div>

            <div className="flex flex-row gap-3 overflow-x-auto">
                <div className="card flex flex-1 min-w-[7rem] flex-col gap-2">
                    <p className="text-xs uppercase tracking-wide text-muted">{t("reviewed")}</p>
                    <div className="index-divider" />
                    <p className="stat-value">{dailyStats.items_reviewed}</p>
                </div>
                <div className="card flex flex-1 min-w-[7rem] flex-col gap-2">
                    <p className="text-xs uppercase tracking-wide text-muted">{t("correct")}</p>
                    <div className="index-divider" />
                    <p className="stat-value">{dailyStats.items_correct}</p>
                </div>
                <div className="card flex flex-1 min-w-[7rem] flex-col gap-2">
                    <p className="text-xs uppercase tracking-wide text-muted">{t("accuracy")}</p>
                    <div className="index-divider" />
                    <p className="stat-value">{accuracy}%</p>
                </div>
                <div className="card flex flex-1 min-w-[7rem] flex-col gap-2">
                    <p className="text-xs uppercase tracking-wide text-muted">{t("studyTime")}</p>
                    <div className="index-divider" />
                    <p className="stat-value">{studiedMinutes} min</p>
                </div>
                <div className="card flex flex-1 min-w-[7rem] flex-col gap-2">
                    <p className="text-xs uppercase tracking-wide text-muted">{t("currentStreak")}</p>
                    <div className="index-divider" />
                    <p className="stat-value">{dailyStats.current_streak_length}</p>
                </div>
            </div>
        </section>
    );
}