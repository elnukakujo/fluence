import Calligraphy from "@/interface/features/Calligraphy";
import { getCalligraphyByLesson } from "@/api/calligraphy";
import ReviewSession from "@/components/review/ReviewSession";
import { getTranslations } from "next-intl/server";

export default async function CalligraphyFlashCardPage({ params }: { params: Promise<{ language_id: string; lesson_id: string; }>}) {
    const t = await getTranslations("languages");
    const { language_id, lesson_id } = await params;

    const calligraphies: Calligraphy[] = await getCalligraphyByLesson(lesson_id);
    calligraphies.sort(() => Math.random() - 0.5); // Shuffle the array randomly

    return (
        <main>
            <h1>{t("calligraphyFlashcard")}</h1>
            <ReviewSession items={calligraphies} options={{ languageId: language_id, completeOnFinish: false, finishAction: "lesson" }} />
        </main>
    );
}
