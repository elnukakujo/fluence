import { getCalligraphyByLesson } from "@/api/calligraphy";
import { getGrammarByLesson } from "@/api/grammar";
import { getVocabularyByLesson } from "@/api/vocabulary";
import ExerciseForm from "@/components/exercises/exerciseForm";
import Calligraphy from "@/interface/features/Calligraphy";
import Grammar from "@/interface/features/Grammar";
import Vocabulary from "@/interface/features/Vocabulary";
import { getTranslations } from "next-intl/server";

interface LessonElements {
    vocabularies: Vocabulary[];
    grammars: Grammar[];
    calligraphies: Calligraphy[];
}

export default async function createExercisePage({ params }: { params: Promise<{ lesson_id: string }> }) {
    const t = await getTranslations("languages");
    const { lesson_id } = await params;

    const calligraphies: Calligraphy[] = await getCalligraphyByLesson(lesson_id);
    const grammars: Grammar[] = await getGrammarByLesson(lesson_id);
    const vocabularies: Vocabulary[] = await getVocabularyByLesson(lesson_id);

    const lessonElements: LessonElements = {
        vocabularies,
        grammars,
        calligraphies
    };

    return (
        <main className="flex flex-col items-center justify-center">
            <h1 className="mb-4">{t("createNewExercise")}</h1>
            <ExerciseForm lesson_id={lesson_id} lessonElements={lessonElements} />
        </main>
    );
}