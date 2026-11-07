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
const COLS = ["", "sm:grid-cols-1", "sm:grid-cols-2", "sm:grid-cols-3"]; // static so Tailwind generates them

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
        <section className="flex flex-col gap-4" aria-labelledby="goal-overview">
            <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="flex flex-col gap-0.5">
                    <h4 id="goal-overview" className="inline-flex items-center gap-2 font-serif text-base text-ink"><Target size={18} aria-hidden />{t("goalMenuTitle")}</h4>
                    <p className="text-sm text-muted">
                        {t(`period_${p.period}`)} · {day(p.cycle_start)} – {day(p.cycle_end)}
                        {p.active ? ` · ${t("goalDaysLeft", { n: daysLeft })}` : ""}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {!p.active && <span className="badge">{t("goalPaused")}</span>}
                    <Link href={settingsHref} className="btn btn-secondary min-h-11 inline-flex items-center gap-2"><Settings size={16} aria-hidden />{t("goalEdit")}</Link>
                </div>
            </header>
            {p.next.pending && <p className="text-sm text-muted" role="note">{t("goalNextPeriod", { date: day(p.next.start) })}</p>}
            {tiles.length > 0 && (
                <ul className={`grid gap-3 list-none pl-0 ${COLS[tiles.length]}`}>
                    {tiles.map(([kind, label, Icon]) => {
                        const row = p.types[kind];
                        const mine = p.items.filter((i) => i.kind === kind);
                        return (
                            <li key={kind} className="goal-tile">
                                <span className="inline-flex items-center gap-2 text-sm text-muted"><Icon size={16} aria-hidden />{t(label)}</span>
                                {row.n > 0 && (
                                    <div className="flex flex-col gap-1">
                                        <p className="flex items-baseline justify-between text-sm"><span>{t("goalColNew")}</span>
                                            <span className="text-lg font-semibold tabular-nums" aria-label={t("goalProgress", { mastered: row.mastered, picked: row.picked })}>{row.mastered}<span className="text-sm font-normal text-muted"> / {row.picked}</span></span></p>
                                        <ProgressBar thin current={row.mastered} total={Math.max(row.picked, 1)} showLabel={false} showPercent={false} ariaLabel={`${t(label)}: ${t("goalColNew")}`} />
                                        {row.picked < row.n && (
                                            <span className="badge badge-warn self-start" title={t("goalShortHint")}><TriangleAlert size={12} aria-hidden />{t("goalShort", { picked: row.picked, n: row.n })}</span>
                                        )}
                                    </div>
                                )}
                                {row.r > 0 && (
                                    <div className="flex flex-col gap-1">
                                        <p className="flex items-baseline justify-between text-sm"><span>{t("goalColReview")}</span>
                                            <span className="text-lg font-semibold tabular-nums" aria-label={t("goalReviewProgress", { done: row.review_done, picked: row.review_picked })}>{row.review_done}<span className="text-sm font-normal text-muted"> / {row.review_picked}</span></span></p>
                                        <ProgressBar thin accent current={row.review_done} total={Math.max(row.review_picked, 1)} showLabel={false} showPercent={false} ariaLabel={`${t(label)}: ${t("goalColReview")}`} />
                                        {row.review_picked < row.r && (
                                            <span className="badge badge-warn self-start" title={t("goalReviewShortHint")}><TriangleAlert size={12} aria-hidden />{t("goalReviewShort", { picked: row.review_picked, n: row.r })}</span>
                                        )}
                                    </div>
                                )}
                                {mine.length > 0 && (
                                    <details className="text-sm">
                                        <summary className="cursor-pointer text-muted min-h-8 inline-flex items-center">{t("goalElements", { n: mine.length })}</summary>
                                        <div className="flex flex-col gap-2 pt-1">
                                            {group(mine.filter((i) => i.role === "new"), t("goalColNew"))}
                                            {group(mine.filter((i) => i.role === "review"), t("goalColReview"))}
                                        </div>
                                    </details>
                                )}
                                {row.carried > 0 && <span className="text-xs text-muted">{t("goalCarried", { n: row.carried })}</span>}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
