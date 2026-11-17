"use client"
import { useTranslations } from "next-intl"
import type CommitmentLog from "@/interface/dataCollection/CommitmentLog"
import DateDisplay from "@/components/ui/displays/dateDisplay"

/** Everything since the learner started this language: four figures and when they were last updated. */
export default function CommitmentLogCard({ commitmentLog }: { commitmentLog: CommitmentLog | null }) {
    const t = useTranslations("language")
    function formatMs(ms: number) {
        const totalMinutes = Math.floor(ms / 60000)
        const hours = Math.floor(totalMinutes / 60)
        const minutes = totalMinutes % 60
        return `${hours}h ${minutes}m`
    }

    return (
        <section className="card flex flex-col gap-4" aria-labelledby="commitment-title">
            <header className="flex flex-col gap-0.5">
                <h2 id="commitment-title" className="section-title">{t("commitment")}</h2>
                {commitmentLog && <span className="text-xs text-muted"><DateDisplay date={commitmentLog.updated_at ?? commitmentLog.created_at} message={t("lastUpdatedMessage")} withTime /></span>}
            </header>
            {commitmentLog ? (
                <ul className="grid list-none grid-cols-2 gap-x-3 gap-y-4 pl-0">
                    <li className="figure"><b>{commitmentLog.days_active}</b><span>{t("daysActive")}</span></li>
                    <li className="figure"><b>{commitmentLog.longest_streak_ever}</b><span>{t("longestStreak")}</span></li>
                    <li className="figure"><b>{commitmentLog.total_items_reviewed}</b><span>{t("totalItemsReviewed")}</span></li>
                    <li className="figure"><b>{formatMs(commitmentLog.total_time_ms)}</b><span>{t("totalTimeStudied")}</span></li>
                </ul>
            ) : (
                <p className="text-sm text-muted">{t("noCommitmentData")}</p>
            )}
        </section>
    )
}
