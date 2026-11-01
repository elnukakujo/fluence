"use client"
import { useTranslations } from "next-intl"
import type CommitmentLog from "@/interface/dataCollection/CommitmentLog"
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
                <DateDisplay date={commitmentLog.updated_at ?? commitmentLog.created_at} message={t("lastUpdated")} withTime />
            </div>

            <div className="flex flex-row gap-3 overflow-x-auto">
                <div className="card flex flex-1 min-w-[7rem] flex-col gap-2">
                    <p className="text-xs uppercase tracking-wide text-muted">{t("daysActive")}</p>
                    <div className="index-divider" />
                    <p className="stat-value">{commitmentLog.days_active}</p>
                </div>
                <div className="card flex flex-1 min-w-[7rem] flex-col gap-2">
                    <p className="text-xs uppercase tracking-wide text-muted">{t("totalItemsReviewed")}</p>
                    <div className="index-divider" />
                    <p className="stat-value">{commitmentLog.total_items_reviewed}</p>
                </div>
                <div className="card flex flex-1 min-w-[7rem] flex-col gap-2">
                    <p className="text-xs uppercase tracking-wide text-muted">{t("totalTimeStudied")}</p>
                    <div className="index-divider" />
                    <p className="stat-value">{formatMs(commitmentLog.total_time_ms)}</p>
                </div>
                <div className="card flex flex-1 min-w-[7rem] flex-col gap-2">
                    <p className="text-xs uppercase tracking-wide text-muted">{t("longestStreak")}</p>
                    <div className="index-divider" />
                    <p className="stat-value">{commitmentLog.longest_streak_ever}</p>
                </div>
                <div className="card flex flex-1 min-w-[7rem] flex-col gap-2">
                    <p className="text-xs uppercase tracking-wide text-muted">{t("lastUpdated")}</p>
                    <div className="index-divider" />
                    <div className="text-sm font-medium"><DateDisplay date={commitmentLog.updated_at ?? commitmentLog.created_at} withTime /></div>
                </div>
            </div>
        </section>
    )
}
