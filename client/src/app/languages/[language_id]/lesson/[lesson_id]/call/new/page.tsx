import CalligraphyForm from "@/components/elements/calligraphyForm";
import { getTranslations } from "next-intl/server";
import { listCharacters } from "@/api/character";

export default async function createCalligraphyPage({ params }: { params: Promise<{ language_id: string; lesson_id: string }> }) {
    const t = await getTranslations("languages");
    const { language_id, lesson_id } = await params;
    const known = ((await listCharacters(language_id)) as { character: string }[]).map((c) => c.character);

    return (
        <main className="flex flex-col gap-4">
            <h1>{t("createNewCalligraphy")}</h1>
            <CalligraphyForm lesson_id={lesson_id} knownCharacters={known} />
        </main>
    );
}