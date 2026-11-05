import { getLanguageById } from "@/api/language";
import type Exercise from "@/interface/features/Exercise";
import ExerciseForm from "@/components/exercises/exerciseForm";
import Calligraphy from "@/interface/features/Calligraphy";
import Grammar from "@/interface/features/Grammar";
import Vocabulary from "@/interface/features/Vocabulary";
import { getExerciseById } from "@/api/exercise";
import { getCalligraphyByLesson } from "@/api/calligraphy";
import { getGrammarByLesson } from "@/api/grammar";
import { getVocabularyByLesson } from "@/api/vocabulary";
import { getTranslations } from "next-intl/server";

type paramsType = {
    language_id: string;
    lesson_id: string;
    ex_id: string;
};

interface LessonElements {
    vocabularies: Vocabulary[];
    grammars: Grammar[];
    calligraphies: Calligraphy[];
}

export default async function UpdateExercisePage({ params }: { params: Promise<paramsType> }) {
    const t = await getTranslations("languages");
    const { language_id, lesson_id, ex_id } = await params;
    const exercise: Exercise = await getExerciseById(ex_id);

    const calligraphies: Calligraphy[] = await getCalligraphyByLesson(lesson_id);
    const grammars: Grammar[] = await getGrammarByLesson(lesson_id);
    const vocabularies: Vocabulary[] = await getVocabularyByLesson(lesson_id);

    const lessonElements: LessonElements = {
        calligraphies,
        grammars,
        vocabularies
    };

    return (
        <main>
            <h1 className="mb-4">{t("updateExerciseInformations")}</h1>
            <ExerciseForm languageIso={(await getLanguageById(language_id)).target_iso639_2t} exercise={exercise} lesson_id={lesson_id} lessonElements={lessonElements} />
        </main>
    );
}