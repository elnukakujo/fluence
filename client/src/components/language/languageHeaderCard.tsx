'use client';

import { useTranslations } from "next-intl";
import Language from "@/interface/containers/Language";
import { ISO639_2T_to_LANGUAGE } from "@/utils/language_iso639";
import SharedBadge from "../collaboration/sharedBadge";
import Markdown from "react-markdown";
import type { LanguageSummary } from "@/interface/dataCollection/HomeStats";
import LevelMiniBar from "./levelMiniBar";
import remarkGfm from 'remark-gfm';

/** The language's identity and, as children, its study actions (the primary one is the daily review). */
export default function LanguageHeaderCard({ language, summary, children }: { language: Language; summary?: LanguageSummary; children?: React.ReactNode }) {
    const t = useTranslations("language");
    const tHome = useTranslations("home");
    return (
        <section className="card tile-hero grid gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="flex min-w-0 flex-col gap-3">
                <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-5xl leading-none" aria-hidden>{language.flag}</span>
                    <h1 className="text-4xl">{language.name}{language.alias ? ` (${language.alias})` : ""}</h1>
                    {language.collaborators && language.collaborators.length > 0 && (
                        <SharedBadge count={language.collaborators.length} />
                    )}
                    {!!language.shared_lesson_count && <SharedBadge incoming count={language.shared_lesson_count} />}
                    {language.partial_collaborators && language.partial_collaborators.length > 0 && (
                        <SharedBadge partial count={language.partial_collaborators.length} />
                    )}
                </header>
                <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                    {language.source_iso639_2t && <><span className="badge">{t("from")}</span>{ISO639_2T_to_LANGUAGE[language.source_iso639_2t]}</>}
                    {language.target_iso639_2t && <><span className="badge">{t("to")}</span>{ISO639_2T_to_LANGUAGE[language.target_iso639_2t]}</>}
                </p>
                {language.description && <div className="prose-sm text-muted">
                    <Markdown remarkPlugins={[remarkGfm]}>{language.description}</Markdown>
                </div>}
                {children && <div className="mt-auto pt-2">{children}</div>}
            </div>
            {summary && (
                <div className="flex flex-col gap-4 md:border-l md:border-dashed md:border-border md:pl-6">
                    <LevelMiniBar {...summary.levels} large />
                    <p className="flex items-baseline justify-between gap-3 rounded-lg bg-accent-soft px-3 py-2 text-sm">
                        <span className="font-medium text-ink">{tHome("due")}</span>
                        <strong className="text-ink">{tHome("dueValue", { count: summary.due, minutes: summary.due_minutes })}</strong>
                    </p>
                </div>
            )}
        </section>
    );
}
