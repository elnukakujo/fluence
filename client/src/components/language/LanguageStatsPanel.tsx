"use client"
import React, { useState } from "react"
import { useTranslations } from "next-intl"
import type DailyStats from "@/interface/dataCollection/DailyStats"
import type CommitmentLog from "@/interface/dataCollection/CommitmentLog"
import DailyStatsCard from "./dailyStatsCard"
import CommitmentLogCard from "./CommitmentLogCard"
import StudyGoalOverview from "./studyGoalOverview"
import type { StudyGoalState } from "@/api/studyGoal"

export default function LanguageStatsPanel({ dailyStats, commitmentLog, studyGoal = null, settingsHref = "" }: { dailyStats: DailyStats | null, commitmentLog: CommitmentLog | null, studyGoal?: StudyGoalState | null, settingsHref?: string }) {
    const t = useTranslations("language")
    const [view, setView] = useState<'daily' | 'commitment' | 'goal'>(dailyStats ? 'daily' : 'commitment')

    return (
        <div className="flex flex-col gap-3">
            <div className="btn-row border-b border-dashed border-[var(--border)] pb-2">
                <button
                    className={`btn ${view === 'daily' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setView('daily')}
                >{t("daily")}</button>
                <button
                    className={`btn ${view === 'commitment' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setView('commitment')}
                >{t("commitmentTab")}</button>
                {studyGoal?.goal && <button
                    className={`btn ${view === 'goal' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setView('goal')}
                >{t("goalTab")}</button>}
            </div>

            <div>
                {view === 'daily' && <DailyStatsCard dailyStats={dailyStats!} />}
                {view === 'commitment' && <CommitmentLogCard commitmentLog={commitmentLog!} />}
                {view === 'goal' && <StudyGoalOverview state={studyGoal} settingsHref={settingsHref} />}
            </div>
        </div>
    )
}
