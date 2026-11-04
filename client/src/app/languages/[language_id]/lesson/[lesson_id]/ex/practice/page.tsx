import Exercise from "@/interface/features/Exercise";
import { getExercisesByLesson } from "@/api/exercise";
import { getLessonById } from "@/api/lesson";
import { bcp47 } from "@/utils/speech";
import ExercisePractice from "@/components/exercises/exercisePractice";
import { getTranslations } from "next-intl/server";

export default async function PracticeExercisePage({ params }: { params: Promise<{ lesson_id: string }> }) {
    const t = await getTranslations("languages");
    const { lesson_id } = await params;

    const [exercises, lesson]: [Exercise[], { target_iso639_2t?: string }] = await Promise.all([getExercisesByLesson(lesson_id), getLessonById(lesson_id)]);
    exercises.sort(() => Math.random() - 0.5); // Shuffle the array randomly

    return (
        <main>
            <h1>{t("exercisePractice")}</h1>
            <ExercisePractice exercise_lists={exercises} lang={bcp47(lesson?.target_iso639_2t)} />
        </main>
    );
}