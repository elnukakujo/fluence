import { getAvailableLanguages } from "@/api/language";
import { getCurrentUserId } from "@/utils/user_cookie";
import LanguageGrid from "./languageGrid";
import Language from "@/interface/containers/Language";
import type { LanguageSummary } from "@/interface/dataCollection/HomeStats";

export default async function AvailableLanguages({ summaries, title }: { summaries?: LanguageSummary[]; title?: string }) {
    const userId: string | null = await getCurrentUserId();
    const languages: Language[] = await getAvailableLanguages(userId!);

    return <LanguageGrid languages={languages} userId={userId ?? ""} title={title} summaries={summaries && Object.fromEntries(summaries.map((s) => [s.id, s]))} />;
}
