"use client";

import type Grammar from "@/interface/features/Grammar";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { updateScoreById } from "@/api/process";
import BackButton from "@/components/ui/buttons/backButton";
import GrammarCard from "./grammarCard";
import ElementTagsCard from "./elementTagsCard";
import SentenceCard from "./sentenceCard";
import ElementPerformanceCard from "./elementPerformanceCard";
import ElementSourcesCard from "./elementSourcesCard";
import WordCard from "./wordCard";
import ProgressBar from "@/components/ui/progressBar";
import RecallGradeButtons from "@/components/ui/buttons/recallGradeButtons";

export default function GrammarFlashCard({ grammars }: { grammars: Grammar[] }) {
    const t = useTranslations("grammar");
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const grammar: Grammar = grammars[currentIndex];
    const startTimeRef = useRef<number>(performance.now());
    const [hintUsed, setHintUsed] = useState<boolean>(false);
    const [hiddenTranslation, setHiddenTranslation] = useState<boolean>(true);
    const [graded, setGraded] = useState<boolean>(false);

    useEffect(() => {
        startTimeRef.current = performance.now();
        setHintUsed(false);
        setHiddenTranslation(true);
        setGraded(false);
    }, [currentIndex]);

    const handleGrade = (score: number) => {
        setGraded(true);
        const duration_ms = Math.round(performance.now() - startTimeRef.current);
        updateScoreById(grammar.id!, score, duration_ms, hintUsed);
    };

    const reveal = () => {
        if (!hiddenTranslation) return;
        setHiddenTranslation(false);
        setHintUsed(true);
    };

    const handleGoNext = () => {
        setCurrentIndex(currentIndex + 1);
    };


    return (
        <article className="flex flex-col space-y-6 max-w-2xl mx-auto">
            <ProgressBar
                current={currentIndex + (graded ? 1 : 0)}
                total={grammars.length}
            />
            <section className="flex flex-col space-y-4">
                <h1>{t("sheet")}</h1>
                <div className="flashcard">
                    <div className={`flashcard-inner ${!hiddenTranslation ? "is-flipped" : ""}`}>
                        <div
                            className="flashcard-face card cursor-pointer flex flex-col space-y-4"
                            role="button"
                            tabIndex={0}
                            onClick={reveal}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); reveal(); } }}
                        >
                            <h3 className="font-serif">{grammar.title}</h3>
                            <p className="text-sm opacity-60">{t("flashcardTitle")}</p>
                        </div>
                        <div className="flashcard-face flashcard-face-back flex flex-col space-y-4">
                            <GrammarCard grammar={grammar} />
                        </div>
                    </div>
                </div>
            </section>
            {!hiddenTranslation && !graded && (
                <RecallGradeButtons onGrade={handleGrade} />
            )}
            {graded && (
                <>
                    {grammar.example_words && grammar.example_words.length > 0 && (
                        <section className="flex flex-col space-y-4 items-baseline">
                            <h3 className="font-serif">{t("exampleWords")}</h3>
                            {grammar.example_words.map((word, index) => (
                                <WordCard key={index} word={word} hiddenTranslation={false} hiddenAdditionalInformations={false} />
                            ))}
                        </section>
                    )}
                    {grammar.example_sentences && grammar.example_sentences.length > 0 && (
                        <section className="flex flex-col space-y-4 items-baseline">
                            <h3 className="font-serif">{t("exampleSentences")}</h3>
                            {grammar.example_sentences.map((sentence, index) => (
                                <SentenceCard key={index} sentence={sentence} hiddenTranslation={false} />
                            ))}
                        </section>
                    )}
                    <ElementTagsCard element={grammar} />
                    <ElementSourcesCard element={grammar} />
                    <ElementPerformanceCard element={grammar} />
                    {currentIndex < grammars.length - 1 ? (
                        <button className="btn btn-primary" onClick={() => handleGoNext()}>
                            <p>{t("nextButton")}</p>
                        </button>
                    ) : (
                        <BackButton>
                            <p>Back to Lesson</p>
                        </BackButton>
                    )}
                </>
            )}
        </article>
    );
}
