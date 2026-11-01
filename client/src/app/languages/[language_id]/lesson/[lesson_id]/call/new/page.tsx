import CalligraphyForm from "@/components/elements/calligraphyForm";
import { getTranslations } from "next-intl/server";

export default async function createCalligraphyPage({ params }: { params: Promise<{ lesson_id: string }> }) {
    const t = await getTranslations("languages");
    const { lesson_id } = await params;

    return (
        <main className="flex flex-col gap-4">
            <h1>{t("createNewCalligraphy")}</h1>
            <CalligraphyForm lesson_id={lesson_id} />
        </main>
    );
}