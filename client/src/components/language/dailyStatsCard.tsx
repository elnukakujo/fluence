"use client";

import { useTranslations } from "next-intl";
import StatTile from "@/components/ui/statTile";
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

            <div className="stat-chips">
                <StatTile label={t("reviewed")}>{dailyStats.items_reviewed}</StatTile>
                <StatTile label={t("correct")}>{dailyStats.items_correct}</StatTile>
                <StatTile label={t("accuracy")}>{accuracy}%</StatTile>
                <StatTile label={t("studyTime")}>{studiedMinutes} min</StatTile>
                <StatTile label={t("currentStreak")}>{dailyStats.current_streak_length}</StatTile>
            </div>
        </section>
    );
}