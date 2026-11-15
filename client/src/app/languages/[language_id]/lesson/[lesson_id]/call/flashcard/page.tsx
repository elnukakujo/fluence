import Calligraphy from "@/interface/features/Calligraphy";
import { getCalligraphyByLesson } from "@/api/calligraphy";
import { orderSingleSided } from "@/lib/lessonStudy";
import { getSidePattern } from "@/lib/lessonStudyPreferences";
import ReviewSession from "@/components/review/ReviewSession";
import { getTranslations } from "next-intl/server";

export default async function CalligraphyFlashCardPage({ params }: { params: Promise<{ language_id: string; lesson_id: string; }>}) {
    const t = await getTranslations("languages");
    const { language_id, lesson_id } = await params;

    const calligraphies: Calligraphy[] = await getCalligraphyByLesson(lesson_id);

    return (
        <main>
            <h1>{t("calligraphyFlashcard")}</h1>
            <ReviewSession items={orderSingleSided(calligraphies, await getSidePattern())} options={{ languageId: language_id, finishAction: "lesson" }} />
        </main>
    );
}
