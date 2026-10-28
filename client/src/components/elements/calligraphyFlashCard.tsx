"use client";

import { updateScoreById } from "@/api/process";
import { submitCalligraphyDrawing } from "@/api/calligraphy";
import { useEffect, useRef, useState } from "react";
import Calligraphy from "@/interface/features/Calligraphy";
import BackButton from "@/components/ui/buttons/backButton";
import CalligraphyPracticeCanvas from "./calligraphyPracticeCanvas";
import CharacterCard from "./characterCard";
import WordCard from "./wordCard";
import SentenceCard from "./sentenceCard";
import ElementTagsCard from "./elementTagsCard";
import ElementSourcesCard from "./elementSourcesCard";
import ElementPerformanceCard from "./elementPerformanceCard";
import ProgressBar from "@/components/ui/progressBar";
import RecallGradeButtons from "@/components/ui/buttons/recallGradeButtons";

export default function CalligraphyFlashCard({ calligraphies }: { calligraphies: Calligraphy[] }) {
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const calligraphy: Calligraphy = calligraphies[currentIndex];
    const startTimeRef = useRef<number>(performance.now());
    const [hintUsed, setHintUsed] = useState<boolean>(false);

    const [hiddenTranslation, setHiddenTranslation] = useState<boolean>(true);
    const [graded, setGraded] = useState<boolean>(false);
    const [showPractice, setShowPractice] = useState<boolean>(false);
    const [practiceScore, setPracticeScore] = useState<number | null>(null);
    const [practiceResult, setPracticeResult] = useState<{ similarity: number; strokeOrderErrors: number } | null>(null);

    useEffect(() => {
        startTimeRef.current = performance.now();
        setHintUsed(false);
        setHiddenTranslation(true);
        setGraded(false);
        setShowPractice(false);
        setPracticeScore(null);
        setPracticeResult(null);
    }, [currentIndex]);

    const handleGrade = (score: number) => {
        setGraded(true);
        const duration_ms = Math.round(performance.now() - startTimeRef.current);
        updateScoreById(calligraphy.id!, score, duration_ms, hintUsed);
    };

    const reveal = () => {
        if (!hiddenTranslation) return;
        setHiddenTranslation(false);
        setHintUsed(true);
    };

    const handleGoNext = () => {
        setCurrentIndex(currentIndex + 1);
    }

    const handleDrawingResult = async (r: { similarity: number; strokeOrderErrors: number }) => {
        const duration_ms = Math.round(performance.now() - startTimeRef.current);
        try {
            const res = await submitCalligraphyDrawing(calligraphy.id!, r.similarity, r.strokeOrderErrors, duration_ms);
            setPracticeScore(res.calligraphy?.score ?? null);
            setPracticeResult({ similarity: r.similarity, strokeOrderErrors: r.strokeOrderErrors });
            setGraded(true);
            setShowPractice(false);
        } catch (e) {
            console.error("Failed to submit drawing", e);
        }
    }

    return (
        <article className="flex flex-col space-y-6 max-w-2xl mx-auto">
            <ProgressBar
                current={currentIndex + (graded ? 1 : 0)}
                total={calligraphies.length}
            />
            <section className="flex flex-col space-y-4">
                <div className="flex items-baseline justify-between">
                    <h1>Calligraphy Sheet</h1>
                    {!showPractice && (
                        <button className="btn" onClick={() => setShowPractice(true)}>Practice</button>
                    )}
                </div>
                {showPractice ? (
                    <CalligraphyPracticeCanvas character={calligraphy.character.character ?? ""} onResult={handleDrawingResult} />
                ) : (
                <div className="flashcard">
                    <div className={`flashcard-inner ${!hiddenTranslation ? "is-flipped" : ""}`}>
                        <div
                            className="flashcard-face card cursor-pointer flex flex-col space-y-4"
                            role="button"
                            tabIndex={0}
                            onClick={reveal}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); reveal(); } }}
                        >
                            <h3 className="font-serif">Character</h3>
                            <CharacterCard character={calligraphy.character} hiddenTranslation={true} hiddenAdditionalInformations={true} />
                            <p className="text-sm opacity-60">Click to reveal</p>
                        </div>
                        <div className="flashcard-face flashcard-face-back flex flex-col space-y-4">
                            <div className="card flex flex-col space-y-4">
                                <h3 className="font-serif">Meaning</h3>
                                <CharacterCard character={calligraphy.character} hiddenTranslation={false} hiddenAdditionalInformations={false} />
                            </div>
                        </div>
                    </div>
                </div>
                )}
            </section>
            {!hiddenTranslation && !graded && (
                <RecallGradeButtons onGrade={handleGrade} />
            )}
            {graded && (
                <>
                    {practiceResult !== null && (
                        <section className="flex flex-col space-y-2">
                            <h3 className="font-serif">Practice Result</h3>
                            <p className="text-sm">Shape similarity: {Math.round(practiceResult.similarity * 100)}%</p>
                            <p className="text-sm">
                                Stroke order: {practiceResult.strokeOrderErrors === 0
                                    ? "correct"
                                    : `${practiceResult.strokeOrderErrors} error${practiceResult.strokeOrderErrors === 1 ? "" : "s"}`}
                            </p>
                            {practiceScore !== null && (
                                <p className="text-sm">Score: {Math.round(practiceScore)}/100</p>
                            )}
                        </section>
                    )}
                    {calligraphy.example_words && (
                        <section className="flex flex-col space-y-4 items-baseline">
                            <h3 className="font-serif">Example Words</h3>
                            {calligraphy.example_words.map((word, index) => (
                                <WordCard key={index} word={word} hiddenTranslation={false} hiddenAdditionalInformations={true} />
                            ))}
                        </section>
                    )}
                    {calligraphy.example_sentences && (
                        <section className="flex flex-col space-y-4 items-baseline">
                            <h3 className="font-serif">Example Sentences</h3>
                            {calligraphy.example_sentences.map((sentence, index) => (
                                <SentenceCard key={index} sentence={sentence} hiddenTranslation={false} />
                            ))}
                        </section>
                    )}
                    <ElementTagsCard element={calligraphy} />
                    <ElementSourcesCard element={calligraphy} />
                    <ElementPerformanceCard element={calligraphy} />
                    {currentIndex < calligraphies.length - 1 ? (
                        <button className="btn btn-primary" onClick={() => handleGoNext()}>
                            <p>Next Calligraphy</p>
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
