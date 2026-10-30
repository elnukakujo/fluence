'use client';

import Language from "@/interface/containers/Language";
import { ISO639_2T_to_LANGUAGE } from "@/utils/language_iso639";
import SharedBadge from "../collaboration/sharedBadge";
import Markdown from "react-markdown";
import remarkGfm from 'remark-gfm';

export default function LanguageHeaderCard({ language }: { language: Language }) { 
    return (
        <section className="card flex flex-col space-y-2">
            <header className="flex items-baseline gap-2">
                <h1>{language.flag} {language.name} ({language.alias})</h1>
                {language.collaborators && language.collaborators.length > 0 && (
                    <SharedBadge count={language.collaborators.length} />
                )}
                {language.partial_collaborators && language.partial_collaborators.length > 0 && (
                    <SharedBadge partial count={language.partial_collaborators.length} />
                )}
            </header>
            <div className="index-divider pt-3 flex flex-col space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                    {language.source_iso639_2t && (
                        <div className="card flex flex-col gap-1 p-3">
                            <p className="badge w-fit">From</p>
                            <p className="font-medium">{ISO639_2T_to_LANGUAGE[language.source_iso639_2t]}</p>
                        </div>
                    )}
                    {language.target_iso639_2t && (
                        <div className="card flex flex-col gap-1 p-3">
                            <p className="badge w-fit">To</p>
                            <p className="font-medium">{ISO639_2T_to_LANGUAGE[language.target_iso639_2t]}</p>
                        </div>
                    )}
                </div>
                {language.description && <div className="pt-3 flex flex-col space-y-2">
                    <Markdown remarkPlugins={[remarkGfm]}>{language.description}</Markdown>
                </div>}
            </div>
        </section>
    );
}