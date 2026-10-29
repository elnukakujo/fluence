"use client";

import { useRouter } from 'next/navigation';
import type Language from '@/interface/containers/Language';
import { languageProficiencySystems, getLevelLabel } from '@/utils/language_iso639';
import ScoreDisplay from '../ui/displays/scoreDisplay';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function LanguageOverviewCard({ language }: { language: Language }) {
    const router = useRouter();

    const handleCardClick = () => {
        router.push(`/languages/${language.id}`);
    };

    const system = languageProficiencySystems[language.target_iso639_2t ?? ""];
    const levelLabel = getLevelLabel(system, language.level);

    const sourceLanguage = languageProficiencySystems[language.source_iso639_2t ?? ""];

    return (
        <button
            className="card overview-card flex flex-col gap-2 overflow-hidden text-left cursor-pointer transition hover:-translate-y-0.5 hover:bg-accent-soft hover:shadow-md"
            onClick={handleCardClick}
        >
            <header className="flex flex-col">
                <p className="text-2xl">{language.flag}</p>
                <div className="flex items-center gap-2">
                    <h3 className="font-serif text-lg text-ink line-clamp-1">{language.name} ({language.alias})</h3>
                    {language.collaborators && language.collaborators.length > 0 && (
                        <span className="badge shrink-0">Shared</span>
                    )}
                </div>
                <span className="text-xs flex flex-row gap-1 items-center text-muted">
                    <p>From</p>
                    <p className="badge">{sourceLanguage?.englishName ?? 'Unknown'}</p>
                </span>
            </header>
            <div className="index-divider line-clamp-4 flex-1 text-sm text-muted prose-sm">
                <Markdown remarkPlugins={[remarkGfm]}>{language.description}</Markdown>
            </div>
            <footer>
                <h5 className="text-xs uppercase tracking-wide text-muted">{levelLabel}</h5>
                <ScoreDisplay score={language.score} />
            </footer>
        </button>
    );
}