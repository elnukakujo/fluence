"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BookOpen, Brush, Lock, PenLine, Sparkles } from "lucide-react";
import SectionCard from "@/components/user/sectionCard";
import SaveButton from "@/components/user/saveButton";
import ToggleRow from "@/components/user/toggleRow";
import NumberField from "@/components/ui/input/numberField";
import RebuildMenuDialog from "./rebuildMenuDialog";
import { getAvailableLanguages } from "@/api/language";
import { getStudyGoal, resetStudyGoal, saveStudyGoal, type GoalKind, type StudyGoal, type StudyGoalState } from "@/api/studyGoal";
import type Language from "@/interface/containers/Language";

const PERIODS: StudyGoal["period"][] = ["week", "biweek", "month"];
type Draft = Pick<StudyGoal, "period" | "n_vocabulary" | "n_grammar" | "n_calligraphy" | "r_vocabulary" | "r_grammar" | "r_calligraphy" | "active" | "auto">;
const KINDS: { kind: GoalKind; label: string; n: keyof Draft; r: keyof Draft; Icon: typeof BookOpen }[] = [
    { kind: "vocabulary", label: "section_voc", n: "n_vocabulary", r: "r_vocabulary", Icon: BookOpen },
    { kind: "grammar", label: "section_gram", n: "n_grammar", r: "r_grammar", Icon: PenLine },
    { kind: "calligraphy", label: "section_call", n: "n_calligraphy", r: "r_calligraphy", Icon: Brush },
];
const BLANK: Draft = { period: "week", n_vocabulary: 0, n_grammar: 0, n_calligraphy: 0, r_vocabulary: 0, r_grammar: 0, r_calligraphy: 0, active: true, auto: false };
const draftOf = (s: StudyGoalState): Draft => s.goal ? {
    period: s.goal.period, active: s.goal.active, auto: s.goal.auto,
    n_vocabulary: s.goal.n_vocabulary, n_grammar: s.goal.n_grammar, n_calligraphy: s.goal.n_calligraphy,
    r_vocabulary: s.goal.r_vocabulary, r_grammar: s.goal.r_grammar, r_calligraphy: s.goal.r_calligraphy,
} : BLANK;

/** Study goals: per language, how many new and how many review elements each period's menu holds. The running
 *  period is locked; what is saved here starts with the next one. One Save writes every edited language. */
export default function StudyGoalsCard({ userId }: { userId: string }) {
    const t = useTranslations("study");
    const locale = useLocale();
    const [languages, setLanguages] = useState<Language[]>([]);
    const [languageId, setLanguageId] = useState("");
    const [states, setStates] = useState<Record<string, StudyGoalState>>({});
    const [drafts, setDrafts] = useState<Record<string, Draft>>({});
    const [dirty, setDirty] = useState<Set<string>>(new Set());
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getAvailableLanguages(userId).then((l: Language[]) => { setLanguages(l); setLanguageId((cur) => cur || l[0]?.id || ""); }).catch(() => {});
    }, [userId]);

    useEffect(() => {
        if (!languageId || states[languageId]) return;
        getStudyGoal(languageId)
            .catch(() => ({ goal: null, progress: null }) as StudyGoalState)
            .then((s) => { setStates((x) => ({ ...x, [languageId]: s })); setDrafts((d) => ({ ...d, [languageId]: draftOf(s) })); });
    }, [languageId, states]);

    const [confirming, setConfirming] = useState(false);
    const restart = async () => {
        setConfirming(false);
        setError("");
        try {
            const s = await resetStudyGoal(languageId);
            setStates((x) => ({ ...x, [languageId]: s }));
        } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    };

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSaving(true);
        try {
            for (const id of dirty) {
                const s = await saveStudyGoal(id, drafts[id]);
                setStates((x) => ({ ...x, [id]: s }));
                setDrafts((d) => ({ ...d, [id]: draftOf(s) }));
            }
            setDirty(new Set());
        } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
        finally { setSaving(false); }
    };

    if (languages.length === 0) return null;
    const draft = drafts[languageId];
    const progress = states[languageId]?.progress;
    // changing a quantity makes the goal the user's own (it stops following the daily minutes)
    const edit = (patch: Partial<Draft>, own = false) => {
        setDrafts((d) => ({ ...d, [languageId]: { ...d[languageId], ...patch, ...(own ? { auto: false } : {}) } }));
        setDirty((s) => new Set(s).add(languageId));
    };
    const suggested = states[languageId]?.suggested;
    const useSuggested = () => suggested && edit({
        auto: true,
        n_vocabulary: suggested.n.vocabulary, n_grammar: suggested.n.grammar, n_calligraphy: suggested.n.calligraphy,
        r_vocabulary: suggested.r.vocabulary, r_grammar: suggested.r.grammar, r_calligraphy: suggested.r.calligraphy,
    });
    const date = (iso: string) => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

    return (
        <form onSubmit={save}>
            <SectionCard title={t("goalTitle")}>
                <p className="text-sm text-muted">{t("goalHint")}</p>
                <label className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="opacity-70">{t("goalLanguage")}</span>
                    <select className="input w-auto" value={languageId} onChange={(e) => setLanguageId(e.target.value)}>
                        {languages.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                </label>

                <RebuildMenuDialog open={confirming} mastered={progress?.rebuild?.mastered ?? 0} redraw={progress?.rebuild?.redraw ?? 0}
                    onConfirm={restart} onCancel={() => setConfirming(false)} />
                {progress && (
                    <section className="lock-panel" role="note">
                        <div className="lock-head">
                            <button type="button" className="lock-btn" disabled={dirty.has(languageId)} onClick={() => setConfirming(true)}
                                aria-label={t("goalUnlockLabel")} title={dirty.has(languageId) ? t("goalUnlockSaveFirst") : t("goalUnlockLabel")}>
                                <Lock size={18} aria-hidden />
                            </button>
                            <div className="flex flex-col">
                                <p className="font-semibold">{t("goalLockedTitle", { end: date(progress.cycle_end) })}</p>
                                <p className="text-sm text-muted">{date(progress.cycle_start)} – {date(progress.cycle_end)} · {t("goalUnlockHint")}</p>
                            </div>
                        </div>
                        <ul className="lock-rows">
                            {KINDS.filter((k) => progress.types[k.kind].n + progress.types[k.kind].r > 0).map(({ kind, label, Icon }) => (
                                <li key={kind} className="lock-row">
                                    <span className="lock-row-name"><Icon size={16} className="text-accent" aria-hidden />{t(label)}</span>
                                    <span className="pill"><b>{progress.types[kind].n}</b>{t("goalColNew").toLowerCase()}</span>
                                    <span className="pill"><b>{progress.types[kind].r}</b>{t("goalColReview").toLowerCase()}</span>
                                </li>
                            ))}
                        </ul>
                        <details className="callout">
                            <summary>{t("goalHowTitle")}</summary>
                            <p className="mt-1">{t("goalHowBody")}</p>
                        </details>
                        <p className="text-sm text-muted">{progress.next.pending || dirty.has(languageId) ? t("goalChangesFrom", { date: date(progress.next.start) }) : t("goalNoChanges")}</p>
                    </section>
                )}

                {draft && (
                    <>
                        <div className="flex flex-col gap-1">
                            <span className="text-sm opacity-70">{t("period")}</span>
                            <div className="filter-chips" role="group" aria-label={t("period")}>
                                {PERIODS.map((k) => (
                                    <button key={k} type="button" aria-pressed={draft.period === k} className={`filter-chip min-h-11 px-4 text-sm ${draft.period === k ? "active" : ""}`} onClick={() => edit({ period: k })}>{t(`period_${k}`)}</button>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" role="status">
                            <span className={`inline-flex items-center gap-1.5 ${draft.auto ? "text-accent" : "text-muted"}`}>
                                <Sparkles size={14} aria-hidden />{draft.auto ? t("goalAuto") : t("goalCustom")}
                            </span>
                            {draft.auto
                                ? <span className="text-muted">{t("goalAutoHint")}</span>
                                : suggested && <button type="button" className="btn btn-secondary min-h-11" onClick={useSuggested}>{t("goalUseSuggested")}</button>}
                        </div>
                        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-3" role="group" aria-label={t("goalQuantities")}>
                            <span aria-hidden />
                            <span className="text-xs uppercase tracking-wide text-muted">{t("goalColNew")}</span>
                            <span className="text-xs uppercase tracking-wide text-muted">{t("goalColReview")}</span>
                            {KINDS.map(({ kind, label, n, r, Icon }) => (
                                <div key={kind} className="contents">
                                    <span className="inline-flex items-center gap-2 text-sm"><Icon size={16} aria-hidden className="text-muted" />{t(label)}</span>
                                    <NumberField ariaLabel={`${t(label)}: ${t("goalColNew")}`} value={draft[n] as number} onChange={(v) => edit({ [n]: v === "" ? 0 : v }, true)} />
                                    <NumberField ariaLabel={`${t(label)}: ${t("goalColReview")}`} value={draft[r] as number} onChange={(v) => edit({ [r]: v === "" ? 0 : v }, true)} />
                                </div>
                            ))}
                        </div>
                        <ToggleRow label={t("goalActive")} description={t("goalActiveDesc")} checked={draft.active} onChange={(v) => edit({ active: v })} />
                    </>
                )}
                {error && <p role="alert" className="text-sm text-danger">{error}</p>}
                <div><SaveButton isLoading={saving} /></div>
            </SectionCard>
        </form>
    );
}
