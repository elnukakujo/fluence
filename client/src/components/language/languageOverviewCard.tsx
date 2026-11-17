"use client";

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type Language from '@/interface/containers/Language';
import type { LanguageSummary } from '@/interface/dataCollection/HomeStats';
import { languageProficiencySystems, getLevelLabel } from '@/utils/language_iso639';
import SharedBadge from '../collaboration/sharedBadge';
import ScoreDisplay from '../ui/displays/scoreDisplay';
import LanguageSummaryCard from './languageSummaryCard';

/** The home card of one language. The whole card opens the language; with the learner's numbers it also carries the daily review button. */
export default function LanguageOverviewCard({ language, summary }: { language: Language; summary?: LanguageSummary }) {
    const t = useTranslations("language");
    const tHome = useTranslations("home");
    const system = languageProficiencySystems[language.target_iso639_2t ?? ""];
    const levelLabel = getLevelLabel(system, language.level);
    const sourceLanguage = languageProficiencySystems[language.source_iso639_2t ?? ""];

    return (
        <article className="card lang-card">
            <header className="flex flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="font-serif text-lg text-ink line-clamp-2">
                        <Link href={`/languages/${language.id}`} className="stretched-link focus-visible:outline-none">
                            {language.flag} {language.name}{language.alias ? ` (${language.alias})` : ""}
                        </Link>
                    </h3>
                    <span className="badge shrink-0">{levelLabel}</span>
                </div>
                <span className="flex flex-wrap items-center gap-1 text-xs text-muted">
                    {t("from")} <span className="badge">{sourceLanguage?.englishName ?? 'Unknown'}</span>
                    {language.collaborators && language.collaborators.length > 0 && <SharedBadge count={language.collaborators.length} />}
                    {!!language.shared_lesson_count && <SharedBadge incoming count={language.shared_lesson_count} />}
                    {language.partial_collaborators && language.partial_collaborators.length > 0 && (
                        <SharedBadge partial count={language.partial_collaborators.length} />
                    )}
                </span>
            </header>
            {summary ? <LanguageSummaryCard language={summary} /> : <ScoreDisplay score={language.score} />}
            {summary && (
                <Link href={`/languages/${language.id}/review`} className="btn btn-primary above-link min-h-11 justify-center">
                    {tHome("reviewNow", { count: summary.due })}
                </Link>
            )}
        </article>
    );
}
