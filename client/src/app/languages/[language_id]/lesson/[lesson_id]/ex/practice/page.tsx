import Exercise from "@/interface/features/Exercise";
import { getExercisesByLesson } from "@/api/exercise";
import ExercisePractice from "@/components/exercises/exercisePractice";
import { selectPracticeExercises } from "@/utils/practice";
import { getTranslations } from "next-intl/server";

export default async function PracticeExercisePage({ params }: { params: Promise<{ lesson_id: string }> }) {
    const t = await getTranslations("languages");
    const { lesson_id } = await params;

    const exercises: Exercise[] = selectPracticeExercises(await getExercisesByLesson(lesson_id));

    return (
        <main>
            <h1>{t("exercisePractice")}</h1>
            <ExercisePractice exercise_lists={exercises} />
        </main>
    );
}