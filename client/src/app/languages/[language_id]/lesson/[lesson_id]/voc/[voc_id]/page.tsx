import DeleteButton from "@/components/ui/buttons/deleteButton";
import NavButton from "@/components/layout/navButton";
import type Vocabulary from "@/interface/features/Vocabulary";
import ElementPerformanceCard from "@/components/elements/elementPerformanceCard";
import ElementSourcesCard from "@/components/elements/elementSourcesCard";
import ElementTagsCard from "@/components/elements/elementTagsCard";
import WordCard from "@/components/elements/wordCard";
import SentenceCard from "@/components/elements/sentenceCard";
import RelatedCard from "@/components/elements/relatedCard";
import { getVocabularyById } from "@/api/vocabulary";
import { getTranslations } from "next-intl/server";

export default async function VocabularyPage({ params }: { params: Promise<{ language_id: string, lesson_id: string, voc_id: string }> }) {
    const t = await getTranslations("languages");
    const { voc_id, lesson_id, language_id } = await params;
    const vocabulary: Vocabulary = await getVocabularyById(voc_id);
    return (
        <main>
            <article className="flex flex-col space-y-4">
                <h1>{t("vocabularySheet")}</h1>
                <WordCard word={vocabulary.word} />
                {vocabulary.example_sentences!.length > 0 && (
                    <section className="flex flex-col space-y-4 items-baseline">
                        <h3>{t("exampleSentences")}</h3>
                        {vocabulary.example_sentences!.map((sentence, idx) => (
                            <SentenceCard key={idx} sentence={sentence} />
                        ))}
                    </section>
                )}
                <RelatedCard
                    languageId={language_id}
                    words={[vocabulary.word]}
                    passages={vocabulary.example_sentences}
                />
                <ElementTagsCard element={vocabulary} />
                <ElementSourcesCard element={vocabulary} />
                <ElementPerformanceCard element={vocabulary}/>
            </article>
            <nav className="flex flex-row space-x-4">
                <NavButton path={`/languages/${language_id}/lesson/${lesson_id}/voc/${voc_id}/update`}>
                    {t("updateVocabularyButton")}
                </NavButton>
                <DeleteButton element_id={vocabulary.id!}>{t("deleteVocabularyButton")}</DeleteButton>
            </nav>
        </main>
    );
}
