import Vocabulary from "@/interface/features/Vocabulary";
import { getVocabularyByLesson } from "@/api/vocabulary";
import VocabularyFlashCard from "@/components/elements/vocabularyFlashCard";
import { getTranslations } from "next-intl/server";

export default async function VocabularyFlashCardPage({ params }: { params: Promise<{ language_id: string; lesson_id: string; voc_id: string }>}) {
    const t = await getTranslations("languages");
    const { lesson_id } = await params;

    const vocabularies: Vocabulary[] = await getVocabularyByLesson(lesson_id);
    // every vocabulary on both sides: all fronts, then all backs (each shuffled)
    const shuffled = () => [...vocabularies].sort(() => Math.random() - 0.5);
    const items: Vocabulary[] = [
        ...shuffled().map((v) => ({ ...v, side: "front" as const })),
        ...shuffled().map((v) => ({ ...v, side: "back" as const })),
    ];

    return (
        <main>
            <h1>{t("vocabularyFlashcard")}</h1>
            <VocabularyFlashCard vocabularies={items} />
        </main>
    );
}