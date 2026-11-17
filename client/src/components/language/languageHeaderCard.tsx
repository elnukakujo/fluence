'use client';

import { useTranslations } from "next-intl";
import Language from "@/interface/containers/Language";
import { ISO639_2T_to_LANGUAGE } from "@/utils/language_iso639";
import SharedBadge from "../collaboration/sharedBadge";
import Markdown from "react-markdown";
import remarkGfm from 'remark-gfm';

/** The language's identity and, as children, its study actions (the primary one is the daily review). */
export default function LanguageHeaderCard({ language, children }: { language: Language; children?: React.ReactNode }) {
    const t = useTranslations("language");
    return (
        <section className="card flex flex-col gap-3">
            <header className="flex items-baseline gap-2">
                <h1>{language.flag} {language.name}{language.alias ? ` (${language.alias})` : ""}</h1>
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
            {children && <div className="index-divider">{children}</div>}
        </section>
    );
}