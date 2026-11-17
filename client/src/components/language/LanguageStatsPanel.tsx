import type DailyStats from "@/interface/dataCollection/DailyStats"
import type CommitmentLog from "@/interface/dataCollection/CommitmentLog"
import DailyStatsCard from "./dailyStatsCard"
import CommitmentLogCard from "./CommitmentLogCard"
import StudyGoalOverview from "./studyGoalOverview"
import type { StudyGoalState } from "@/api/studyGoal"

/** Today, the commitment since the start and the study goal: three stacked cards, no tabs, so nothing is hidden behind a click. */
export default function LanguageStatsPanel({ dailyStats, commitmentLog, studyGoal = null, settingsHref = "" }: { dailyStats: DailyStats | null, commitmentLog: CommitmentLog | null, studyGoal?: StudyGoalState | null, settingsHref?: string }) {
    return (
        <>
            {dailyStats && <DailyStatsCard dailyStats={dailyStats} />}
            <CommitmentLogCard commitmentLog={commitmentLog} />
            {studyGoal?.goal && <section className="card"><StudyGoalOverview state={studyGoal} settingsHref={settingsHref} /></section>}
        </>
    )
}
