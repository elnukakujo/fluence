import ExerciseForm from "@/components/exercises/exerciseForm";
import { getTranslations } from "next-intl/server";

export default async function createExercisePage({ params }: { params: Promise<{ lesson_id: string }> }) {
    const t = await getTranslations("languages");
    const { lesson_id } = await params;

    return (
        <main className="flex flex-col items-center justify-center">
            <h1 className="mb-4">{t("createNewExercise")}</h1>
            <ExerciseForm lesson_id={lesson_id} />
        </main>
    );
}
