"use client"
import { useTranslations } from "next-intl"
import type CommitmentLog from "@/interface/dataCollection/CommitmentLog"
import StatTile from "@/components/ui/statTile"
import DateDisplay from "@/components/ui/displays/dateDisplay"

export default function CommitmentLogCard({ commitmentLog }: { commitmentLog: CommitmentLog | null }) {
    const t = useTranslations("language")
    function formatMs(ms: number) {
        const totalMinutes = Math.floor(ms / 60000)
        const hours = Math.floor(totalMinutes / 60)
        const minutes = totalMinutes % 60
        return `${hours}h ${minutes}m`
    }

    if (!commitmentLog) {
        return (
            <section className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                    <h4 className="font-serif text-base text-ink">{t("commitment")}</h4>
                </div>
                <div className="text-xs text-muted">{t("noCommitmentData")}</div>
            </section>
        )
    }

    return (
        <section className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between gap-4">
                <h4 className="font-serif text-base text-ink">{t("commitment")}</h4>
                <DateDisplay date={commitmentLog.updated_at ?? commitmentLog.created_at} message={t("lastUpdatedMessage")} withTime />
            </div>

            <div className="stat-chips">
                <StatTile label={t("daysActive")}>{commitmentLog.days_active}</StatTile>
                <StatTile label={t("totalItemsReviewed")}>{commitmentLog.total_items_reviewed}</StatTile>
                <StatTile label={t("totalTimeStudied")}>{formatMs(commitmentLog.total_time_ms)}</StatTile>
                <StatTile label={t("longestStreak")}>{commitmentLog.longest_streak_ever}</StatTile>
            </div>
        </section>
    )
}
