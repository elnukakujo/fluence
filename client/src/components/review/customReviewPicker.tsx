"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { queueHref } from "@/api/review";
import EmptyState from "@/components/ui/emptyState";
import TypeCards from "./typeCards";
import type { TypeStats } from "@/api/dailyStats";

type Choice = { id: string; label: string; color?: string };
type Tab = "type" | "source" | "tag";
const TABS: Tab[] = ["type", "source", "tag"];

/** Custom review: one criterion at a time (type, source or tag); each choice opens the existing queue page with that scope.
 *  Components (words, characters, passages) are never offered: `types` holds only what a course studies. */
export default function CustomReviewPicker({ languageId, types, sources, tags, stats }: {
    languageId: string; types: string[]; sources: Choice[]; tags: Choice[]; stats?: TypeStats | null;
}) {
    const t = useTranslations("languages");
    const [active, setActive] = useState<Tab>("type");
    const refs = useRef<Record<Tab, HTMLButtonElement | null>>({ type: null, source: null, tag: null });

    const move = (e: React.KeyboardEvent, from: Tab) => {      // WAI-ARIA tabs: arrows wrap, Home/End jump, focus follows selection
        const i = TABS.indexOf(from);
        const to = e.key === "ArrowRight" ? TABS[(i + 1) % TABS.length] : e.key === "ArrowLeft" ? TABS[(i + TABS.length - 1) % TABS.length]
            : e.key === "Home" ? TABS[0] : e.key === "End" ? TABS[TABS.length - 1] : null;
        if (!to) return;
        e.preventDefault();
        setActive(to);
        refs.current[to]?.focus();
    };

    const choices: Record<Tab, Choice[]> = {
        type: types.map((type) => ({ id: type, label: t(`typeLabel.${type}`) })),
        source: sources, tag: tags,
    };
    const hrefOf = (tab: Tab, id: string) => queueHref(languageId, tab === "type" ? { scope: "type", type: id } : tab === "source" ? { scope: "source", source_id: id } : { scope: "tag", tag_id: id });
    const list = choices[active];

    return (
        <section className="flex flex-col gap-4">
            <div role="tablist" aria-label={t("customTabsLabel")} className="flex flex-wrap gap-x-5 border-b border-gray-300 dark:border-gray-700">
                {TABS.map((tab) => (
                    <button key={tab} ref={(el) => { refs.current[tab] = el; }} type="button" role="tab" id={`custom-tab-${tab}`}
                        aria-selected={tab === active} aria-controls="custom-panel" tabIndex={tab === active ? 0 : -1}
                        className="review-tab min-h-11" data-active={tab === active}
                        onClick={() => setActive(tab)} onKeyDown={(e) => move(e, tab)}>
                        {t(`customTab.${tab}`)}
                    </button>
                ))}
            </div>
            <div role="tabpanel" id="custom-panel" aria-labelledby={`custom-tab-${active}`} className="flex flex-col gap-3">
                <p className="text-muted">{t(`customHint.${active}`)}</p>
                {list.length === 0 ? (
                    <EmptyState className="card">{t(`customEmpty.${active}`)}</EmptyState>
                ) : active === "type" ? (
                    <TypeCards languageId={languageId} types={types} stats={stats} />
                ) : (
                    <ul className="flex list-none flex-wrap gap-3 pl-0">
                        {list.map((c) => (
                            <li key={c.id}>
                                <Link className="btn btn-secondary min-h-11 inline-flex items-center gap-2" href={hrefOf(active, c.id)}>
                                    {c.color && <span aria-hidden className="inline-block h-3 w-3 rounded-full" style={{ background: c.color }} />}
                                    {c.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}
