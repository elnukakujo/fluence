import GrammarForm from "@/components/elements/grammarForm";
import { getTranslations } from "next-intl/server";

export default async function createGrammarPage({ params }: { params: Promise<{ lesson_id: string }> }) {
    const t = await getTranslations("languages");
    const { lesson_id } = await params;

    return (
        <main className="flex flex-col gap-4">
            <h1>{t("createNewGrammar")}</h1>
            <GrammarForm lesson_id={lesson_id} />
        </main>
    );
}