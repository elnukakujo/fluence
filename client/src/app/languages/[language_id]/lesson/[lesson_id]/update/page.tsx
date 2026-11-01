import Lesson from "@/interface/containers/Lesson";
import { getLessonById } from "@/api/lesson";
import LessonForm from "@/components/lesson/lessonForm";
import { getTranslations } from "next-intl/server";

export default async function UpdateLessonPage({ params }: { params: Promise<{ language_id: string, lesson_id: string }> }) {
    const t = await getTranslations("languages");
    const { language_id, lesson_id } = await params;

    const lesson: Lesson = await getLessonById(lesson_id);

    return (
        <main>
            <h1>{t("updateLesson")}</h1>
            <LessonForm language_id={language_id} lesson={lesson} />
        </main>
    );
}