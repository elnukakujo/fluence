import LanguageForm from "@/components/language/languageForm";
import { getTranslations } from "next-intl/server";

export default async function NewLanguagePage() {
    const t = await getTranslations("languages");
    return (
        <main>
            <h1>{t("createNewLanguage")}</h1>
            <LanguageForm />
        </main>
    );
}