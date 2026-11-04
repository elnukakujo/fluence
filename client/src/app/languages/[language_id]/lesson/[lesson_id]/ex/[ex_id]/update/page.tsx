import type Exercise from "@/interface/features/Exercise";
import ExerciseForm from "@/components/exercises/exerciseForm";
import { getExerciseById } from "@/api/exercise";
import { getTranslations } from "next-intl/server";

type paramsType = {
    language_id: string;
    lesson_id: string;
    ex_id: string;
};

export default async function UpdateExercisePage({ params }: { params: Promise<paramsType> }) {
    const t = await getTranslations("languages");
    const { lesson_id, ex_id } = await params;
    const exercise: Exercise = await getExerciseById(ex_id);

    return (
        <main>
            <h1 className="mb-4">{t("updateExerciseInformations")}</h1>
            <ExerciseForm exercise={exercise} lesson_id={lesson_id} />
        </main>
    );
}
