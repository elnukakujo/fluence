import { Suspense } from "react";
import LanguageImportWizard from "@/components/ingestion/languageImportWizard";
import { getLanguageData } from "@/api/language";
import { getCurrentUserId } from "@/utils/user_cookie";
import { getTranslations } from "next-intl/server";

export default async function LanguageImportPage({ params }: { params: Promise<{ language_id: string }> }) {
    const t = await getTranslations("languages");
    const { language_id } = await params;
    const { language } = await getLanguageData(language_id);
    const userId = await getCurrentUserId();
    return (
        <main className="flex flex-col gap-6">
            <Suspense fallback={<div className="card max-w-2xl" aria-busy="true">{t("loading")}</div>}>
                <LanguageImportWizard languageId={language_id} languageName={language.name} settingsHref={`/user/${userId}/update`} />
            </Suspense>
        </main>
    );
}
