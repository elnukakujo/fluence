import { getAvailableLanguages } from "@/api/language";
import { getCurrentUserId } from "@/utils/user_cookie";
import LanguageGrid from "./languageGrid";
import Language from "@/interface/containers/Language";

export default async function AvailableLanguages() {
    const userId: string | null = await getCurrentUserId();
    const languages: Language[] = await getAvailableLanguages(userId!);

    return <LanguageGrid languages={languages} userId={userId ?? ""} />;
}
