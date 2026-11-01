import { Suspense } from "react";
import ImportWizard from "@/components/ingestion/importWizard";
import { getLessonById } from "@/api/lesson";
import { getCurrentUserId } from "@/utils/user_cookie";
import { getTranslations } from "next-intl/server";

export default async function ImportPage({ params }: { params: Promise<{ language_id: string; lesson_id: string }> }) {
    const t = await getTranslations("languages");
    const { language_id, lesson_id } = await params;
    const lesson = await getLessonById(lesson_id);
    const userId = await getCurrentUserId();
    return (
        <main className="flex flex-col gap-6">
            <Suspense fallback={<div className="card max-w-2xl" aria-busy="true">{t("loading")}</div>}>
                <ImportWizard languageId={language_id} lessonId={lesson_id} lessonTitle={lesson.title}
                    settingsHref={`/user/${userId}/update`} />
            </Suspense>
        </main>
    );
}
