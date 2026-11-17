import { getLessonCards } from "@/api/review";
import ReviewSession from "@/components/review/ReviewSession";
import { getTranslations } from "next-intl/server";

export default async function CalligraphyFlashCardPage({ params }: { params: Promise<{ language_id: string; lesson_id: string; }>}) {
    const t = await getTranslations("languages");
    const { language_id, lesson_id } = await params;

    return (
        <main>
            <h1>{t("calligraphyFlashcard")}</h1>
            <ReviewSession items={await getLessonCards(language_id, lesson_id, "calligraphy")} options={{ languageId: language_id, finishAction: "lesson" }} />
        </main>
    );
}
