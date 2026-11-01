"use client";

import BackButton from "@/components/ui/buttons/backButton";
import { updateScoreById } from "@/api/process";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type Vocabulary from "@/interface/features/Vocabulary";
import WordCard from "./wordCard";
import SentenceCard from "./sentenceCard";
import ElementPerformanceCard from "./elementPerformanceCard";
import ElementSourcesCard from "./elementSourcesCard";
import ElementTagsCard from "./elementTagsCard";
import ProgressBar from "@/components/ui/progressBar";
import RecallGradeButtons from "@/components/ui/buttons/recallGradeButtons";

export default function VocabularyFlashCard({ vocabularies }: { vocabularies: Vocabulary[] }) {
    const t = useTranslations("vocabulary");
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const vocabulary: Vocabulary = vocabularies[currentIndex];
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
        updateScoreById(vocabulary.id!, score, duration_ms, hintUsed);
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
                total={vocabularies.length}
            />

            {/* ── Flip card ────────────────────────────────────────── */}
            <div className="flashcard">
                <div className={`flashcard-inner ${!hiddenTranslation ? "is-flipped" : ""}`}>
                    <div
                        className="flashcard-face card cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onClick={reveal}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                reveal();
                            }
                        }}
                    >
                        <WordCard word={vocabulary.word} hiddenTranslation={true} hiddenAdditionalInformations={false} />
                        <p className="text-sm text-muted text-center mt-3">{t("flashcardTitle")}</p>
                    </div>
                    <div className="flashcard-face flashcard-face-back card">
                        <WordCard word={vocabulary.word} hiddenTranslation={false} hiddenAdditionalInformations={false} />
                    </div>
                </div>
            </div>

            {/* ── Grade buttons ────────────────────────────────────── */}
            {!hiddenTranslation && !graded && (
                <RecallGradeButtons onGrade={handleGrade} />
            )}

            {/* ── Post-grade content ───────────────────────────────── */}
            {graded && (
                <>
                    {vocabulary.example_sentences && vocabulary.example_sentences.length > 0 && (
                        <section className="flex flex-col space-y-4">
                            <h3 className="font-serif">{t("exampleSentences")}</h3>
                            {vocabulary.example_sentences.map((sentence, index) => (
                                <SentenceCard key={index} sentence={sentence} hiddenTranslation={false} />
                            ))}
                        </section>
                    )}
                    <ElementTagsCard element={vocabulary} />
                    <ElementSourcesCard element={vocabulary} />
                    <ElementPerformanceCard element={vocabulary} />

                    {currentIndex < vocabularies.length - 1 ? (
                        <button className="btn btn-primary" onClick={handleGoNext}>
                            {t("nextButton")}
                        </button>
                    ) : (
                        <BackButton>Back to lesson</BackButton>
                    )}
                </>
            )}
        </article>
    );
}