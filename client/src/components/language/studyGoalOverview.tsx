"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { BookOpen, Brush, Check, PenLine, Settings, Target, TriangleAlert } from "lucide-react";
import ProgressBar from "@/components/ui/progressBar";
import type { GoalItem, GoalKind, StudyGoalProgress, StudyGoalState } from "@/api/studyGoal";

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
    // how far an element is from done, in words: points left to Known (new), sides left (a vocabulary's review), or just "to review"
    const left = (i: GoalItem) => i.to_go == null ? "" : i.role === "new" ? t("goalToKnown", { n: i.to_go }) : i.kind === "vocabulary" ? t("goalSidesLeft", { n: i.to_go }) : t("goalToReview");
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
                            <GoalTile key={kind} t={t} label={label} Icon={Icon} row={row} mine={mine} href={href} left={left} />
                        );
                    })}
                </ul>
            )}
        </section>
    );
}

/** One segment per element on the menu, carried ones included: done solid, started filled by its progress, not started empty; done first, then the closest.
 *  The counts say the same in words, so no colour carries the meaning alone. Pointing at (or tapping) a segment names that element under the strip. */
function Strip({ items, label, active, onActive, left }: { items: GoalItem[]; label: string; active: string | null; onActive: (id: string | null) => void; left: (i: GoalItem) => string }) {
    const t = useTranslations("study");
    const share = (i: GoalItem) => (i.done ? 1 : i.progress ?? 0);
    const sorted = [...items].sort((a, b) => share(b) - share(a));
    const done = items.filter((i) => i.done).length;
    const started = items.filter((i) => !i.done && share(i) > 0).length;
    const none = items.length - done - started;
    const on = items.find((i) => i.id === active);
    return (
        <div className="flex flex-col gap-1">
            <div className="flex gap-[3px]" role="img" aria-label={`${label}: ${t("goalLegendDone", { n: done })}, ${t("goalLegendStarted", { n: started })}, ${t("goalLegendNone", { n: none })}`} data-testid="goal-strip">
                {sorted.map((i) => (
                    <span key={i.id} data-state={i.done ? "done" : share(i) > 0 ? "started" : "none"} data-active={active === i.id}
                        onPointerEnter={() => onActive(i.id)} onPointerLeave={() => onActive(null)} onClick={() => onActive(active === i.id ? null : i.id)}
                        className="relative h-3.5 min-w-[3px] flex-1 cursor-pointer overflow-hidden rounded-[4px] bg-border transition-transform duration-150 data-[active=true]:scale-y-150 data-[active=true]:ring-2 data-[active=true]:ring-ink">
                        <span className={`absolute inset-y-0 left-0 ${i.done ? "bg-success" : "bg-accent"}`} style={{ width: `${Math.round(share(i) * 100)}%` }} />
                    </span>
                ))}
            </div>
            <p className="flex min-h-4 flex-wrap gap-x-3 text-[11px] text-muted" data-testid="strip-readout">
                {on
                    ? <span className="text-ink"><b>{on.label}</b>{on.carried ? " ↺" : ""} · {on.done ? t("goalDone") : left(on)}</span>
                    : <span aria-hidden className="flex gap-x-3"><span>{t("goalLegendDone", { n: done })}</span><span>{t("goalLegendStarted", { n: started })}</span><span>{t("goalLegendNone", { n: none })}</span></span>}
            </p>
        </div>
    );
}

type Tr = ReturnType<typeof useTranslations>;
type Shared = { href: (i: GoalItem) => string | null; left: (i: GoalItem) => string };

/** One type's card. `active` is the element under the pointer, in the strip or in the list: both light it up and the readout names it. */
function GoalTile({ t, label, Icon, row, mine, href, left }: { t: Tr; label: string; Icon: typeof BookOpen; row: StudyGoalProgress["types"][GoalKind]; mine: GoalItem[] } & Shared) {
    const [active, setActive] = useState<string | null>(null);
    return (
        <li className="goal-tile">
            <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-ink"><Icon size={16} aria-hidden />{t(label)}</span>
                {mine.length > 0 && <span className="font-serif text-xl font-semibold tabular-nums text-ink" data-testid="to-go">{mine.every((i) => i.done) ? t("goalAllDone") : <>{mine.filter((i) => !i.done).length} <span className="font-sans text-xs font-normal text-muted">{t("goalToGo")}</span></>}</span>}
            </div>
            {mine.length > 0 && <Strip items={mine} label={t(label)} active={active} onActive={setActive} left={left} />}
            <div className="grid grid-cols-2 gap-4">
                {row.n > 0 && (
                    <Meter title={t("goalColNew")} aria={t("goalProgress", { mastered: row.mastered, picked: row.picked })} value={row.mastered} total={row.picked} partial={row.partial}
                        barLabel={`${t(label)}: ${t("goalColNew")}`} short={row.picked < row.n ? t("goalShort", { picked: row.picked, n: row.n }) : undefined} hint={t("goalShortHint")} />
                )}
                {row.r > 0 && (
                    <Meter accent title={t("goalColReview")} aria={t("goalReviewProgress", { done: row.review_done, picked: row.review_picked })} value={row.review_done} total={row.review_picked} partial={row.review_partial}
                        barLabel={`${t(label)}: ${t("goalColReview")}`} short={row.review_picked < row.r ? t("goalReviewShort", { picked: row.review_picked, n: row.r }) : undefined} hint={t("goalReviewShortHint")} />
                )}
            </div>
            {row.carried > 0 && (
                <Meter title={t("goalCarriedTitle")} aria={t("goalCarried", { n: row.carried })} value={0} total={row.carried} partial={row.carried_partial}
                    barLabel={`${t(label)}: ${t("goalCarriedTitle")}`} hint="" />
            )}
            {(() => {
                const next = mine.filter((i) => !i.done && i.progress != null).sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))[0];
                return next ? <p className="text-xs text-muted">{t("goalClosest", { label: next.label, left: left(next) })}</p> : null;
            })()}
            {mine.length > 0 && (
                <details className="text-xs">
                    <summary className="cursor-pointer text-muted min-h-6 inline-flex items-center">{t("goalElements", { n: mine.length })}</summary>
                    <div className="flex flex-col gap-3 pt-2">
                        <Rows items={mine.filter((i) => i.role === "new")} title={t("goalColNew")} t={t} href={href} left={left} active={active} onActive={setActive} />
                        <Rows items={mine.filter((i) => i.role === "review")} title={t("goalColReview")} t={t} href={href} left={left} active={active} onActive={setActive} />
                    </div>
                </details>
            )}
        </li>
    );
}

/** The list of one role's elements: closest to done first; a row and its strip segment light up together. */
function Rows({ items, title, t, href, left, active, onActive }: { items: GoalItem[]; title: string; t: Tr; active: string | null; onActive: (id: string | null) => void } & Shared) {
    if (items.length === 0) return null;
    const share = (i: GoalItem) => (i.done ? 2 : i.progress ?? 0);
    return (
        <div className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-wide text-muted">{title} · {items.length}</p>
            <ul className="flex list-none flex-col gap-0.5 pl-0">
                {[...items].sort((a, b) => share(b) - share(a)).map((i) => {
                    const to = href(i);
                    const name = <>{i.label}{i.carried && <span aria-hidden className="opacity-60"> ↺</span>}</>;
                    return (
                        <li key={i.id} data-active={active === i.id} onPointerEnter={() => onActive(i.id)} onPointerLeave={() => onActive(null)} onFocus={() => onActive(i.id)} onBlur={() => onActive(null)}
                            className="grid min-h-9 grid-cols-[1rem_minmax(0,6rem)_1fr_auto] items-center gap-2 rounded-lg px-1.5 transition-colors data-[active=true]:bg-accent-soft">
                            <span className="text-success" aria-hidden>{i.done ? <Check size={14} /> : null}</span>
                            {to ? <Link href={to} className="truncate hover:underline" title={i.carried ? t("goalCarriedItem") : undefined}>{name}</Link> : <span className="truncate">{name}</span>}
                            <ProgressBar thin accent={i.role === "review"} current={i.done ? 1 : i.progress ?? 0} total={1} showLabel={false} showPercent={false} ariaLabel={`${i.label}: ${i.done ? t("goalDone") : left(i)}`} />
                            <span className="text-xs tabular-nums text-muted">{i.done ? t("goalDone") : left(i)}</span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

/** One bar of a goal tile: caption, `done / picked`, and, when the language has fewer elements than the goal asks for, a warning icon
 *  (its sentence is the tooltip and, for a screen reader, hidden text). */
function Meter({ title, aria, value, total, barLabel, short, hint, accent = false, partial = 0 }: { title: string; aria: string; value: number; total: number; barLabel: string; short?: string; hint: string; accent?: boolean; partial?: number }) {
    const t = useTranslations("study");
    const extra = Math.round(partial * 10) / 10;                        // 0.3 of an element is still progress: show it with one decimal
    const inProgress = extra > 0 ? t("goalPartial", { n: extra }) : null;
    return (
        <div className="flex min-w-0 flex-col gap-1">
            <p className="flex items-baseline justify-between gap-1 text-xs text-muted">
                <span className="inline-flex items-center gap-1">{title}
                    {short && <span title={`${short}. ${hint}`} className="inline-flex text-warning"><TriangleAlert size={12} aria-hidden /><span className="sr-only">{short}</span></span>}
                </span>
                <span className="text-base font-semibold tabular-nums text-ink" aria-label={inProgress ? `${aria}, ${inProgress}` : aria}>{value}<span className="text-xs font-normal text-muted"> / {total}</span></span>
            </p>
            {inProgress && <p className="text-xs text-muted tabular-nums">{inProgress}</p>}
            <ProgressBar thin accent={accent} current={value} total={Math.max(total, 1)} showLabel={false} showPercent={false} ariaLabel={barLabel} partial={partial} />
        </div>
    );
}
