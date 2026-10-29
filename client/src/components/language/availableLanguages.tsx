import { getAvailableLanguages } from "@/api/language";
import { getCurrentUserId } from "@/utils/user_cookie";
import LanguageOverviewCard from "./languageOverviewCard";
import Language from "@/interface/containers/Language";

export default async function AvailableLanguages() {
    const userId: string | null = await getCurrentUserId();
    const languages: Language[] = await getAvailableLanguages(userId!);

    return (
        <article className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-4">
            {languages.length === 0 && (
                <p className="text-sm text-muted">No available languages found. Please add some.</p>
            )}
            {languages.map((lang, idx) => (
                <LanguageOverviewCard key={idx} language={lang} />
            ))}
        </article>
    );
}