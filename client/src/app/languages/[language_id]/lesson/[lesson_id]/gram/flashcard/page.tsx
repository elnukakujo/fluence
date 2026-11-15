import { orderSingleSided } from "@/lib/lessonStudy";
import { getSidePattern } from "@/lib/lessonStudyPreferences";
import ReviewSession from "@/components/review/ReviewSession";
import type Grammar from "@/interface/features/Grammar";
import { getGrammarByLesson } from "@/api/grammar";
import { getTranslations } from "next-intl/server";

type paramsType = {
    language_id: string;
    lesson_id: string;
};

export default async function GrammarFlashCardPage({ params }: { params: Promise<paramsType> }) {
    const t = await getTranslations("languages");
    const { language_id, lesson_id } = await params;

    const grammars: Grammar[] = await getGrammarByLesson(lesson_id);

    return (
        <main>
            <header>
                <h2>{t("grammarFlashcard")}</h2>
            </header>
            <ReviewSession items={orderSingleSided(grammars, await getSidePattern())} options={{ languageId: language_id, finishAction: "lesson" }} />
        </main>
    );
}
