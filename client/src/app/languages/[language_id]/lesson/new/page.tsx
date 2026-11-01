import LessonForm from "@/components/lesson/lessonForm";
import { getTranslations } from "next-intl/server";

export default async function NewLessonPage({ params }: {params: Promise<{ language_id: string }> }) {
    const t = await getTranslations("languages");
    const { language_id } = await params;

    return (
        <main>
            <h1>{t("createNewLessonForLanguage", { languageId: language_id })}</h1>
            <LessonForm language_id={language_id} />
        </main>
    );
}