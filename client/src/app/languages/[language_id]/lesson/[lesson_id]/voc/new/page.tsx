import VocabularyForm from "@/components/elements/vocabularyForm";
import { getTranslations } from "next-intl/server";

export default async function createVocabularyPage({ params }: { params: Promise<{ lesson_id: string }> }) {
    const t = await getTranslations("languages");
    const { lesson_id } = await params;

    return (
        <main className="flex flex-col gap-4">
            <h1>{t("createNewVocabulary")}</h1>
            <VocabularyForm lesson_id={lesson_id} />
        </main>
    );
}