"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getSessionStats, type SessionStats } from "@/api/review/sessionStats";

/** "5m 12s" / "42s" */
export function formatSessionTime(ms: number): string {
    const s = Math.round(ms / 1000);
    return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

/** The session's totals, shown once the last card is done: cards, correct, time, average score gained, average difficulty change (ST-9). */
export default function SessionSummary({ sessionId }: { sessionId: string }) {
    const t = useTranslations("study");
    const [stats, setStats] = useState<SessionStats | null>(null);
    useEffect(() => {      // the last answer may still be on its way to the server: read again a moment later
        const load = () => getSessionStats(sessionId).then(setStats).catch(() => undefined);
        load();
        const again = setTimeout(load, 1500);
        return () => clearTimeout(again);
    }, [sessionId]);
    if (!stats || stats.cards === 0) return null;
    const sign = (n: number, digits: number) => `${n > 0 ? "+" : ""}${n.toFixed(digits)}`;
    return (
        <section className="card flex flex-col gap-3" aria-labelledby="session-summary-title" data-testid="session-summary">
            <h2 id="session-summary-title" className="section-title">{t("sessionSummaryTitle")}</h2>
            <ul className="grid list-none grid-cols-2 gap-x-3 gap-y-4 pl-0 sm:grid-cols-3">
                <li className="figure"><b>{stats.cards}</b><span>{t("sessionCards")}</span></li>
                <li className="figure"><b>{stats.correct}/{stats.cards}</b><span>{t("sessionCorrect")}</span></li>
                <li className="figure"><b>{formatSessionTime(stats.duration_ms)}</b><span>{t("sessionTime")}</span></li>
                <li className="figure"><b>{sign(stats.avg_score_gain, 1)}</b><span>{t("sessionAvgGain")}</span></li>
                <li className="figure"><b>{sign(stats.avg_difficulty_change, 3)}</b><span>{t("sessionAvgDifficulty")}</span></li>
            </ul>
        </section>
    );
}
