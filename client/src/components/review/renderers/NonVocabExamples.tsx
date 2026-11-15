import { useTranslations } from "next-intl";
import type Grammar from "@/interface/features/Grammar";
import type Calligraphy from "@/interface/features/Calligraphy";
import WordCard from "@/components/elements/wordCard";
import SentenceCard from "@/components/elements/sentenceCard";

/** Example words and sentences shown after grading a grammar or calligraphy card. */
export default function NonVocabExamples({ item }: { item: Grammar | Calligraphy }) {
    const t = useTranslations("elements");
    return (
        <>
            {item.example_words && item.example_words.length > 0 && (
                <section className="flex flex-col space-y-4 items-baseline">
                    <h3 className="font-serif">{t("exampleWords", { ns: "grammar" })}</h3>
                    {item.example_words.map((word, index) => (
                        <WordCard key={index} word={word} hiddenTranslation={false} hiddenAdditionalInformations={false} />
                    ))}
                </section>
            )}
            {item.example_sentences && item.example_sentences.length > 0 && (
                <section className="flex flex-col space-y-4 items-baseline">
                    <h3 className="font-serif">{t("exampleSentences", { ns: "grammar" })}</h3>
                    {item.example_sentences.map((sentence, index) => (
                        <SentenceCard key={index} sentence={sentence} hiddenTranslation={false} />
                    ))}
                </section>
            )}
        </>
    );
}
