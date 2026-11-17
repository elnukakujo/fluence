"use client";

import { useTranslations } from "next-intl";
import type Language from "@/interface/containers/Language";
import { bulkDeleteLanguages, reorderLanguages } from "@/api/language";
import ItemActionBar from "@/components/elements/itemActionBar";
import ManageList from "@/components/elements/manageList";
import { SelectionScope, SelectToggle, useItemSelection } from "@/components/elements/itemSelection";
import type { LanguageSummary } from "@/interface/dataCollection/HomeStats";
import LanguageOverviewCard from "./languageOverviewCard";
import EmptyState from "@/components/ui/emptyState";

// Home page: the user's languages as a card grid, or (select mode) the shared select / reorder list with the action bar.
export default function LanguageGrid({ languages, userId, summaries, title }: { languages: Language[]; userId: string; summaries?: Record<string, LanguageSummary>; title?: string }) {
    const t = useTranslations("language");
    const owned = (l: Language) => l.user_id === userId;
    return (
        <SelectionScope canSelect={languages.some(owned)}
            bar={(b) => (
                <ItemActionBar {...b} userId={userId} onDelete={bulkDeleteLanguages}
                    deleteCopy={{ title: t("deleteLanguagesTitle", { count: b.ids.length }), body: t("deleteLanguagesBody"),
                        confirm: t("deleteNLanguages", { count: b.ids.length }), done: t("deletedLanguages", { count: b.ids.length }) }} />
            )}>
            <Languages languages={languages} owned={owned} summaries={summaries} title={title} />
        </SelectionScope>
    );
}

function Languages({ languages, owned, summaries, title }: { languages: Language[]; owned: (l: Language) => boolean; summaries?: Record<string, LanguageSummary>; title?: string }) {
    const t = useTranslations("language");
    const { isActive, canSelect } = useItemSelection();
    return (
        <section className="flex flex-col gap-3">
            {(title || canSelect) && (
                <div className="flex items-center justify-between gap-3">
                    <h2 className="section-title">{title}</h2>
                    {canSelect && <SelectToggle kind="lang" />}
                </div>
            )}
            {isActive("lang") ? (
                <ManageList kind="lang" onReorder={reorderLanguages}
                    items={languages.map((l) => ({ id: l.id!, title: `${l.name}${l.alias ? ` (${l.alias})` : ""}`, owned: owned(l) }))} />
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
                    {languages.length === 0 && <EmptyState className="text-sm">{t("noAvailableLanguages")}</EmptyState>}
                    {languages.map((lang) => <LanguageOverviewCard key={lang.id} language={lang} summary={summaries?.[lang.id!]} />)}
                </div>
            )}
        </section>
    );
}
