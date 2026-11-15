import { getVocabularyByLesson } from "@/api/vocabulary";
import ReviewSession from "@/components/review/ReviewSession";
import { frontsThenBacks } from "@/lib/lessonStudy";
import { getTranslations } from "next-intl/server";

export default async function VocabularyFlashCardPage({ params }: { params: Promise<{ language_id: string; lesson_id: string }>}) {
    const t = await getTranslations("languages");
    const { language_id, lesson_id } = await params;

    const vocabularies = await getVocabularyByLesson(lesson_id);

    return (
        <main>
            <h1>{t("vocabularyFlashcard")}</h1>
            <ReviewSession items={frontsThenBacks(vocabularies)} options={{ languageId: language_id, finishAction: "lesson" }} />
        </main>
    );
}
