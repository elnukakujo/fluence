"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw, TrendingUp } from "lucide-react";
import { getSessionStats, type SessionStats } from "@/api/review/sessionStats";
import { reviewSessionIdle } from "@/api/apiFetch";
import { queueHref } from "@/api/review";
import ProgressBar from "@/components/ui/progressBar";
import { FormActions } from "@/components/elements/formParts";
import BackButton from "@/components/ui/buttons/backButton";

/** "5m 12s" / "42s" */
export function formatSessionTime(ms: number): string {
    const s = Math.round(ms / 1000);
    return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

/** The end screen (RC-27): how it went first (cards, correct, time), then what moved up, what to revisit, the figures, the split by type and the week's goal,
 *  with one bar that stays in view: back to the course, another round, or just the missed cards. Loaded once, after the last answer's request settled. */
export default function SessionSummary({ sessionId, languageId, backHref, backLabel, againHref }: { sessionId: string; languageId?: string; backHref?: string; backLabel?: string; againHref?: string }) {
    const t = useTranslations("study");
    const tLevel = useTranslations("home.level");
    const tType = useTranslations("languages.typeLabel");
    const [stats, setStats] = useState<SessionStats | null>(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let alive = true;
        reviewSessionIdle().then(() => getSessionStats(sessionId)).then((s) => { if (alive) setStats(s); }).catch(() => { if (alive) setFailed(true); });
        return () => { alive = false; };
    }, [sessionId]);
    const bar = (
        <FormActions wide aboveNav testId="summary-bar">
                <BackButton href={backHref}>{backLabel ?? t("sessionBack")}</BackButton>
                {againHref && <a className="btn btn-primary min-h-11 inline-flex flex-1 items-center justify-center gap-2" href={againHref}><RotateCcw size={16} aria-hidden />{t("sessionAnotherRound")}</a>}
        </FormActions>
    );
    if (!stats && !failed) return (       // the totals take a moment (the last answers are still being saved): a bar says so, and the way out is already there
        <section className="flex flex-col gap-4" aria-busy="true" data-testid="summary-loading">
            <div className="card flex flex-col gap-3" role="status">
                <h2 className="section-title">{t("sessionSummaryTitle")}</h2>
                <ProgressBar indeterminate current={0} total={1} showLabel={false} showPercent={false} ariaLabel={t("sessionLoading")} />
                <p className="text-sm text-muted">{t("sessionLoading")}</p>
            </div>
            {bar}
        </section>
    );
    if (!stats || stats.cards === 0) return bar;       // nothing to total (or it could not be read): just the way out
    const sign = (n: number, digits: number) => `${n > 0 ? "+" : ""}${n.toFixed(digits)}`;
    const missed = stats.to_revisit.length;
    const goal = stats.goal_progress;
    return (
        <section className="fade-in-group flex flex-col gap-4" aria-labelledby="session-summary-title" data-testid="session-summary">
            <div className="card flex flex-col gap-3">
                <h2 id="session-summary-title" className="section-title">{t("sessionSummaryTitle")}</h2>
                <ul className="grid list-none grid-cols-3 gap-3 pl-0">
                    <li className="figure"><b>{stats.cards}</b><span>{t("sessionCards")}</span></li>
                    <li className="figure"><b>{stats.correct}/{stats.cards}</b><span>{t("sessionCorrect")}</span></li>
                    <li className="figure"><b>{formatSessionTime(stats.duration_ms)}</b><span>{t("sessionTime")}</span></li>
                </ul>
            </div>
            {stats.levels_crossed.length > 0 && (
                <div className="card flex flex-col gap-2 border-success" data-testid="levels-crossed">
                    <h3 className="flex items-center gap-2 font-semibold text-success"><TrendingUp size={18} aria-hidden />{t("sessionLevelsUp", { count: stats.levels_crossed.length })}</h3>
                    <ul className="flex list-none flex-wrap gap-2 pl-0">
                        {stats.levels_crossed.map((l) => (
                            <li key={l.id} className="rounded-full bg-accent-soft px-3 py-1 text-sm">{l.label} · {tLevel(l.to)}</li>
                        ))}
                    </ul>
                </div>
            )}
            {missed > 0 && (
                <div className="card flex flex-col gap-2 border-danger" data-testid="to-revisit">
                    <h3 className="font-semibold text-danger">{t("sessionToRevisit", { count: missed })}</h3>
                    {languageId && <a className="btn btn-secondary min-h-11 inline-flex items-center justify-center" href={queueHref(languageId, { scope: "free", ids: stats.to_revisit })}>{t("sessionReviewMissed", { count: missed })}</a>}
                </div>
            )}
            <ul className="card grid list-none grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4">
                <li className="figure"><b>{sign(stats.avg_score_gain, 1)}</b><span>{t("sessionAvgGain")}</span></li>
                <li className="figure"><b>{stats.hints_used}</b><span>{t("sessionHints")}</span></li>
                <li className="figure"><b>{stats.avg_seconds_per_card.toFixed(1)}s</b><span>{t("sessionPace")}</span></li>
                <li className="figure"><b>{sign(stats.avg_difficulty_change, 3)}</b><span>{t("sessionAvgDifficulty")}</span></li>
            </ul>
            {Object.keys(stats.by_type).length > 1 && (
                <ul className="card flex list-none flex-wrap gap-x-6 gap-y-2 text-sm" data-testid="by-type">
                    {Object.entries(stats.by_type).map(([type, n]) => <li key={type}><b>{n}</b> {tType(type)}</li>)}
                </ul>
            )}
            {goal && (
                <div className="card flex flex-col gap-2" data-testid="goal-progress">
                    <h3 className="font-semibold">{t("sessionGoal")}</h3>
                    <ProgressBar thin current={goal.met} total={goal.total} partial={goal.partial} showPercent={false} label={t("sessionGoalMet", { met: goal.met, total: goal.total })} ariaLabel={t("sessionGoal")} />
                </div>
            )}
            {bar}
        </section>
    );
}
