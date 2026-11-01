import type Grammar from "@/interface/features/Grammar";
import GrammarForm from "@/components/elements/grammarForm";
import { getGrammarById } from "@/api/grammar";
import { getTranslations } from "next-intl/server";

type paramsType = {
    language_id: string;
    lesson_id: string;
    gram_id: string;
};

export default async function UpdateGrammarPage({ params }: { params: Promise<paramsType> }) {
    const t = await getTranslations("languages");
    const { gram_id, lesson_id } = await params;
    const grammar: Grammar = await getGrammarById(gram_id);

    return (
        <main className="flex flex-col gap-4">
            <h1>{t("updateGrammar")}</h1>
            <GrammarForm grammar={grammar} lesson_id={lesson_id} />
        </main>
    );
}
