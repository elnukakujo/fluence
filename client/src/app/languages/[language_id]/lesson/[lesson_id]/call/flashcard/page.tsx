import Calligraphy from "@/interface/features/Calligraphy";
import { getCalligraphyByLesson } from "@/api/calligraphy";
import CalligraphyFlashCard from "@/components/elements/calligraphyFlashCard";
import { getTranslations } from "next-intl/server";

export default async function CalligraphyFlashCardPage({ params }: { params: Promise<{ language_id: string; lesson_id: string; }>}) {
    const t = await getTranslations("languages");
    const { lesson_id } = await params;

    const calligraphies: Calligraphy[] = await getCalligraphyByLesson(lesson_id);
    calligraphies.sort(() => Math.random() - 0.5); // Shuffle the array randomly

    return (
        <main>
            <h1>{t("calligraphyFlashcard")}</h1>
            <CalligraphyFlashCard calligraphies={calligraphies} />
        </main>
    );
}