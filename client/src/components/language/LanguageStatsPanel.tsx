"use client"
import React, { useState } from "react"
import { useTranslations } from "next-intl"
import type DailyStats from "@/interface/dataCollection/DailyStats"
import type CommitmentLog from "@/interface/dataCollection/CommitmentLog"
import DailyStatsCard from "./dailyStatsCard"
import CommitmentLogCard from "./CommitmentLogCard"

export default function LanguageStatsPanel({ dailyStats, commitmentLog }: { dailyStats: DailyStats | null, commitmentLog: CommitmentLog | null }) {
    const t = useTranslations("language")
    const [view, setView] = useState<'daily' | 'commitment'>(dailyStats ? 'daily' : 'commitment')

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
            </div>

            <div>
                {view === 'daily' && <DailyStatsCard dailyStats={dailyStats!} />}
                {view === 'commitment' && <CommitmentLogCard commitmentLog={commitmentLog!} />}
            </div>
        </div>
    )
}
