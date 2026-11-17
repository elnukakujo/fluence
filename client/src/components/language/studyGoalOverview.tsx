import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { BookOpen, Brush, Check, PenLine, Settings, Target, TriangleAlert } from "lucide-react";
import ProgressBar from "@/components/ui/progressBar";
import type { GoalItem, GoalKind, StudyGoalState } from "@/api/studyGoal";

const KINDS: [GoalKind, string, typeof BookOpen][] = [
    ["vocabulary", "section_voc", BookOpen],
    ["grammar", "section_gram", PenLine],
    ["calligraphy", "section_call", Brush],
];
const DAY = 86_400_000;
const SEGMENT: Record<GoalKind, string> = { vocabulary: "voc", grammar: "gram", calligraphy: "call" };

/** The period's menu on the language overview: per type, the new elements to learn and the old ones to review,
 *  each with its own bar, and the list of what is on the menu. Renders nothing without a goal. */
export default function StudyGoalOverview({ state, settingsHref, today = new Date() }: { state: StudyGoalState | null; settingsHref: string; today?: Date }) {
    const t = useTranslations("study");
    const locale = useLocale();
    const p = state?.progress;
    if (!state?.goal || !p) return null;
    const fmt = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" });
    const day = (iso: string) => fmt.format(new Date(`${iso}T00:00:00Z`));
    const daysLeft = Math.max(0, Math.ceil((new Date(`${p.cycle_end}T00:00:00Z`).getTime() - today.getTime()) / DAY));
    const tiles = KINDS.filter(([kind]) => p.types[kind].n + p.types[kind].r > 0);

    // the element's own page, where its details, example sentences and performance are
    const href = (i: GoalItem) => i.lesson_id ? `/languages/${state.goal!.language_id}/lesson/${i.lesson_id}/${SEGMENT[i.kind]}/${i.id}` : null;
    const group = (items: GoalItem[], title: string) => items.length > 0 && (
        <div className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-wide text-muted">{title}</p>
            <ul className="flex flex-wrap gap-1.5 list-none pl-0">
                {items.map((i) => (
                    <li key={i.id}>
                        {(() => {
                            const content = <>{i.done && <Check size={12} aria-hidden />}{i.label}{i.carried && <span aria-hidden className="opacity-60"> ↺</span>}</>;
                            const cls = `badge ${i.done ? "badge-ok" : ""}`;
                            const to = href(i);
                            return to
                                ? <Link href={to} className={`${cls} min-h-8 hover:underline`} title={i.carried ? t("goalCarriedItem") : undefined}>{content}</Link>
                                : <span className={cls}>{content}</span>;
                        })()}
                    </li>
                ))}
            </ul>
        </div>
    );

    return (
        <section className="flex flex-col gap-3" aria-labelledby="goal-overview">
            <header className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                    <h4 id="goal-overview" className="inline-flex items-center gap-2 font-serif text-base text-ink"><Target size={18} aria-hidden />{t("goalMenuTitle")}</h4>
                    <p className="text-xs text-muted">
                        {t(`period_${p.period}`)} · {day(p.cycle_start)} – {day(p.cycle_end)}
                        {p.active ? ` · ${t("goalDaysLeft", { n: daysLeft })}` : ""}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {!p.active && <span className="badge">{t("goalPaused")}</span>}
                    <Link href={settingsHref} aria-label={t("goalEdit")} title={t("goalEdit")} className="btn btn-secondary min-h-11 min-w-11 inline-flex items-center justify-center"><Settings size={16} aria-hidden /></Link>
                </div>
            </header>
            {p.next.pending && <p className="text-sm text-muted" role="note">{t("goalNextPeriod", { date: day(p.next.start) })}</p>}
            {tiles.length > 0 && (
                <ul className="grid grid-cols-1 gap-2 list-none pl-0">
                    {tiles.map(([kind, label, Icon]) => {
                        const row = p.types[kind];
                        const mine = p.items.filter((i) => i.kind === kind);
                        return (
                            <li key={kind} className="goal-tile">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="inline-flex items-center gap-2 text-sm font-medium text-ink"><Icon size={16} aria-hidden />{t(label)}</span>
                                    {row.carried > 0 && <span className="text-xs text-muted">{t("goalCarried", { n: row.carried })}</span>}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    {row.n > 0 && (
                                        <Meter title={t("goalColNew")} aria={t("goalProgress", { mastered: row.mastered, picked: row.picked })} value={row.mastered} total={row.picked}
                                            barLabel={`${t(label)}: ${t("goalColNew")}`} short={row.picked < row.n ? t("goalShort", { picked: row.picked, n: row.n }) : undefined} hint={t("goalShortHint")} />
                                    )}
                                    {row.r > 0 && (
                                        <Meter accent title={t("goalColReview")} aria={t("goalReviewProgress", { done: row.review_done, picked: row.review_picked })} value={row.review_done} total={row.review_picked}
                                            barLabel={`${t(label)}: ${t("goalColReview")}`} short={row.review_picked < row.r ? t("goalReviewShort", { picked: row.review_picked, n: row.r }) : undefined} hint={t("goalReviewShortHint")} />
                                    )}
                                </div>
                                {mine.length > 0 && (
                                    <details className="text-xs">
                                        <summary className="cursor-pointer text-muted min-h-6 inline-flex items-center">{t("goalElements", { n: mine.length })}</summary>
                                        <div className="flex flex-col gap-2 pt-1">
                                            {group(mine.filter((i) => i.role === "new"), t("goalColNew"))}
                                            {group(mine.filter((i) => i.role === "review"), t("goalColReview"))}
                                        </div>
                                    </details>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}

/** One bar of a goal tile: caption, `done / picked`, and, when the language has fewer elements than the goal asks for, a warning icon
 *  (its sentence is the tooltip and, for a screen reader, hidden text). */
function Meter({ title, aria, value, total, barLabel, short, hint, accent = false }: { title: string; aria: string; value: number; total: number; barLabel: string; short?: string; hint: string; accent?: boolean }) {
    return (
        <div className="flex min-w-0 flex-col gap-1">
            <p className="flex items-baseline justify-between gap-1 text-xs text-muted">
                <span className="inline-flex items-center gap-1">{title}
                    {short && <span title={`${short}. ${hint}`} className="inline-flex text-warning"><TriangleAlert size={12} aria-hidden /><span className="sr-only">{short}</span></span>}
                </span>
                <span className="text-base font-semibold tabular-nums text-ink" aria-label={aria}>{value}<span className="text-xs font-normal text-muted"> / {total}</span></span>
            </p>
            <ProgressBar thin accent={accent} current={value} total={Math.max(total, 1)} showLabel={false} showPercent={false} ariaLabel={barLabel} />
        </div>
    );
}
