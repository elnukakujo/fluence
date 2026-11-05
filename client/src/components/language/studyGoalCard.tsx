"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Target } from "lucide-react";
import ProgressBar from "@/components/ui/progressBar";
import { getStudyGoal, pickStudyGoalNow, saveStudyGoal, type StudyGoal, type StudyGoalState } from "@/api/studyGoal";

const PERIODS: StudyGoal["period"][] = ["week", "biweek", "month"];
const KINDS = [["vocabulary", "n_vocabulary", "goalVocabulary"], ["grammar", "n_grammar", "goalGrammar"], ["calligraphy", "n_calligraphy", "goalCalligraphy"]] as const;

/** Period study goal of a language: separate quantities per type, with this cycle's progress. */
export default function StudyGoalCard({ languageId }: { languageId: string }) {
    const t = useTranslations("study");
    const [state, setState] = useState<StudyGoalState | null>(null);
    const [period, setPeriod] = useState<StudyGoal["period"]>("week");
    const [counts, setCounts] = useState({ n_vocabulary: 0, n_grammar: 0, n_calligraphy: 0 });
    const [active, setActive] = useState(true);
    const [error, setError] = useState("");

    const apply = (s: StudyGoalState) => {
        setState(s);
        if (s.goal) { setPeriod(s.goal.period); setActive(s.goal.active); setCounts({ n_vocabulary: s.goal.n_vocabulary, n_grammar: s.goal.n_grammar, n_calligraphy: s.goal.n_calligraphy }); }
    };
    useEffect(() => { getStudyGoal(languageId).then(apply).catch(() => setState({ goal: null, progress: null })); }, [languageId]);

    const run = async (action: () => Promise<StudyGoalState>) => {
        setError("");
        try { apply(await action()); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    };

    if (!state) return null;
    const p = state.progress;
    return (
        <section className="card flex flex-col gap-3" aria-labelledby="study-goal-title">
            <h3 id="study-goal-title" className="inline-flex items-center gap-2"><Target size={18} aria-hidden />{t("goalTitle")}</h3>
            <p className="text-sm text-muted">{t("goalHint")}</p>
            <div className="filter-chips" role="group" aria-label={t("period")}>
                {PERIODS.map((k) => (
                    <button key={k} type="button" aria-pressed={period === k} className={`filter-chip min-h-11 ${period === k ? "active" : ""}`} onClick={() => setPeriod(k)}>{t(`period_${k}`)}</button>
                ))}
            </div>
            <div className="flex flex-wrap gap-4">
                {KINDS.map(([, key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm">{t(label)}
                        <input type="number" min={0} className="input w-16 text-center" value={counts[key]} onChange={(e) => setCounts({ ...counts, [key]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
                    </label>
                ))}
            </div>
            <label className="flex items-center gap-2 text-sm min-h-11">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />{t("goalActive")}
            </label>
            <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary min-h-11" onClick={() => run(() => saveStudyGoal(languageId, { period, active, ...counts }))}>{t("goalSave")}</button>
                {state.goal && <button type="button" className="btn btn-secondary min-h-11" onClick={() => run(() => pickStudyGoalNow(languageId))}>{t("goalPickNow")}</button>}
            </div>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            {p ? (
                <div className="flex flex-col gap-2">
                    <p className="text-sm text-muted">{t("goalCycle", { start: p.cycle_start, end: p.cycle_end })}</p>
                    {KINDS.filter(([kind]) => p.types[kind].n > 0).map(([kind, , label]) => (
                        <div key={kind} className="flex flex-col gap-1">
                            <span className="text-sm">{t(label)} — {t("goalProgress", { mastered: p.types[kind].mastered, picked: p.types[kind].picked })}
                                {p.types[kind].carried > 0 && <span className="text-muted"> ({t("goalCarried", { n: p.types[kind].carried })})</span>}
                            </span>
                            <ProgressBar current={p.types[kind].mastered} total={Math.max(p.types[kind].picked, 1)} />
                        </div>
                    ))}
                </div>
            ) : <p className="text-sm text-muted">{t("goalNone")}</p>}
        </section>
    );
}
