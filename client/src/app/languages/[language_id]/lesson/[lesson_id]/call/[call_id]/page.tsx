import type Character from "@/interface/features/Calligraphy";
import NavButton from "@/components/layout/navButton";
import DeleteButton from "@/components/ui/buttons/deleteButton";
import ElementPerformanceCard from "@/components/elements/elementPerformanceCard";
import ElementTagsCard from "@/components/elements/elementTagsCard";
import ElementSourcesCard from "@/components/elements/elementSourcesCard";
import WordCard from "@/components/elements/wordCard";
import SentenceCard from "@/components/elements/sentenceCard";
import CharacterCard from "@/components/elements/characterCard";
import RelatedCard from "@/components/elements/relatedCard";
import { getCalligraphyById } from "@/api/calligraphy";
import { getTranslations } from "next-intl/server";

type paramsType = {
    language_id: string;
    lesson_id: string;
    call_id: string;
};

export default async function CalligraphyPage({ params }: { params: Promise<paramsType> }) {
    const t = await getTranslations("languages");
    const { call_id, language_id, lesson_id } = await params;
    const calligraphy: Character = await getCalligraphyById(call_id);

    return (
        <main>
            <article className="flex flex-col space-y-4">
                <h1>{t("calligraphySheet")}</h1>
                <CharacterCard character={calligraphy.character} />
                {calligraphy.example_words && calligraphy.example_words.length > 0 && (
                    <section className="flex flex-col space-y-4 items-baseline">
                        <h3>{t("exampleWords")}</h3>
                        {calligraphy.example_words.map((word, idx) => (
                            <WordCard key={idx} word={word} />
                        ))}
                    </section>
                )}
                {calligraphy.example_sentences && calligraphy.example_sentences.length > 0 && (
                    <section className="flex flex-col space-y-4 items-baseline">
                        <h3>{t("exampleSentences")}</h3>
                        {calligraphy.example_sentences.map((sentence, idx) => (
                            <SentenceCard key={idx} sentence={sentence} />
                        ))}
                    </section>
                )}

                <RelatedCard
                    languageId={language_id}
                    characters={[calligraphy.character]}
                    words={calligraphy.example_words}
                    passages={calligraphy.example_sentences}
                />

                <ElementTagsCard element={calligraphy} />
                <ElementSourcesCard element={calligraphy} />
                <ElementPerformanceCard element={calligraphy}/>
            </article>
            <nav className="flex flex-row space-x-4">
                <NavButton path={`/languages/${language_id}/lesson/${lesson_id}/call/${call_id}/update`}>
                    {t("updateCalligraphy")}
                </NavButton>
                <DeleteButton element_id={calligraphy.id!}>{t("deleteCalligraphyButton")}</DeleteButton>
            </nav>
        </main>
    );
}