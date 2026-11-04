"use client";

import { useTranslations } from "next-intl";
import type Language from "@/interface/containers/Language";
import { bulkDeleteLanguages, reorderLanguages } from "@/api/language";
import ItemActionBar from "@/components/elements/itemActionBar";
import ManageList from "@/components/elements/manageList";
import { SelectionScope, SelectToggle, useItemSelection } from "@/components/elements/itemSelection";
import LanguageOverviewCard from "./languageOverviewCard";

// Home page: the user's languages as a card grid, or (select mode) the shared select / reorder list with the action bar.
export default function LanguageGrid({ languages, userId }: { languages: Language[]; userId: string }) {
    const t = useTranslations("language");
    const owned = (l: Language) => l.user_id === userId;
    return (
        <SelectionScope canSelect={languages.some(owned)}
            bar={(b) => (
                <ItemActionBar {...b} userId={userId} onDelete={bulkDeleteLanguages}
                    deleteCopy={{ title: t("deleteLanguagesTitle", { count: b.ids.length }), body: t("deleteLanguagesBody"),
                        confirm: t("deleteNLanguages", { count: b.ids.length }), done: t("deletedLanguages", { count: b.ids.length }) }} />
            )}>
            <Languages languages={languages} owned={owned} />
        </SelectionScope>
    );
}

function Languages({ languages, owned }: { languages: Language[]; owned: (l: Language) => boolean }) {
    const t = useTranslations("language");
    const { isActive, canSelect } = useItemSelection();
    return (
        <section className="flex flex-col gap-3">
            {canSelect && <div className="flex justify-end"><SelectToggle kind="lang" /></div>}
            {isActive("lang") ? (
                <ManageList kind="lang" onReorder={reorderLanguages}
                    items={languages.map((l) => ({ id: l.id!, title: `${l.name}${l.alias ? ` (${l.alias})` : ""}`, owned: owned(l) }))} />
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-4">
                    {languages.length === 0 && <p className="text-sm text-muted">{t("noAvailableLanguages")}</p>}
                    {languages.map((lang) => <LanguageOverviewCard key={lang.id} language={lang} />)}
                </div>
            )}
        </section>
    );
}
