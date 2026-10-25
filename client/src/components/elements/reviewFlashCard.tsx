"use client";

import { useEffect, useRef, useState } from "react";
import { updateScoreById } from "@/api/process";
import type Vocabulary from "@/interface/features/Vocabulary";
import type Grammar from "@/interface/features/Grammar";
import type Calligraphy from "@/interface/features/Calligraphy";
import type Exercise from "@/interface/features/Exercise";
import type { ReviewCard } from "@/api/review";
import WordCard from "./wordCard";
import GrammarCard from "./grammarCard";
import CharacterCard from "./characterCard";
import SentenceCard from "./sentenceCard";
import ElementTagsCard from "./elementTagsCard";
import ElementSourcesCard from "./elementSourcesCard";
import ElementPerformanceCard from "./elementPerformanceCard";
import ExerciseRunner from "@/components/exercises/exerciseRunner";
import ProgressBar from "@/components/ui/progressBar";
import RecallGradeButtons from "@/components/ui/buttons/recallGradeButtons";
import BackButton from "@/components/ui/buttons/backButton";

const isVocabulary = (c: ReviewCard): c is Vocabulary => "word" in c;
const isGrammar = (c: ReviewCard): c is Grammar => "title" in c;
const isCalligraphy = (c: ReviewCard): c is Calligraphy => "character" in c;
const isExercise = (c: ReviewCard): c is Exercise => "exercise_type" in c;

const typeLabel = (c: ReviewCard) =>
    isVocabulary(c) ? "Vocabulary" : isGrammar(c) ? "Grammar" : isCalligraphy(c) ? "Calligraphy" : "Exercise";

export default function ReviewFlashCard({ cards }: { cards: ReviewCard[] }) {
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const startTimeRef = useRef<number>(performance.now());
    const [hintUsed, setHintUsed] = useState<boolean>(false);
    const [hiddenTranslation, setHiddenTranslation] = useState<boolean>(true);
    const [graded, setGraded] = useState<boolean>(false);

    const card = cards[currentIndex];

    useEffect(() => {
        startTimeRef.current = performance.now();
        setHintUsed(false);
        setHiddenTranslation(true);
        setGraded(false);
    }, [currentIndex]);

    if (!card) {
        return (
            <article className="flex flex-col space-y-6 max-w-2xl mx-auto items-center">
                <p className="text-muted">Nothing to review today 🎉</p>
                <BackButton>Back to Language</BackButton>
            </article>
        );
    }

    const handleGrade = (score: number) => {
        setGraded(true);
        const duration_ms = Math.round(performance.now() - startTimeRef.current);
        updateScoreById(card.id, score, duration_ms, hintUsed);
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
                total={cards.length}
            />

            {/* ── Card metadata ───────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span className="badge">{typeLabel(card)}</span>
                {card.lesson_title && <span>Lesson: {card.lesson_title}</span>}
                <span>Created: {new Date(card.created_at).toLocaleDateString()}</span>
                {card.last_seen_at && <span>Last seen: {new Date(card.last_seen_at).toLocaleDateString()}</span>}
            </div>

            {isExercise(card) ? (
                // Exercises are interactive practice, not flip-cards.
                <>
                    <ExerciseRunner key={card.id} exercise={card} />
                    {currentIndex < cards.length - 1 ? (
                        <button className="btn btn-primary self-end" onClick={handleGoNext}>
                            Next
                        </button>
                    ) : (
                        <BackButton>Back to Language</BackButton>
                    )}
                </>
            ) : (
                <>
                    {/* ── Flip card ────────────────────────────────── */}
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
                                {isVocabulary(card) && (
                                    <WordCard word={card.word} hiddenTranslation={true} hiddenAdditionalInformations={false} />
                                )}
                                {isGrammar(card) && (
                                    <h3 className="font-serif">{card.title}</h3>
                                )}
                                {isCalligraphy(card) && (
                                    <>
                                        <h3 className="font-serif">Character</h3>
                                        <CharacterCard character={card.character} hiddenTranslation={true} hiddenAdditionalInformations={true} />
                                    </>
                                )}
                                <p className="text-sm text-muted text-center mt-3">Click to reveal</p>
                            </div>
                            <div className="flashcard-face flashcard-face-back card">
                                {isVocabulary(card) && (
                                    <WordCard word={card.word} hiddenTranslation={false} hiddenAdditionalInformations={false} />
                                )}
                                {isGrammar(card) && (
                                    <GrammarCard grammar={card} />
                                )}
                                {isCalligraphy(card) && (
                                    <CharacterCard character={card.character} hiddenTranslation={false} hiddenAdditionalInformations={false} />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Grade buttons ────────────────────────────── */}
                    {!hiddenTranslation && !graded && (
                        <RecallGradeButtons onGrade={handleGrade} />
                    )}

                    {/* ── Post-grade content ───────────────────────── */}
                    {graded && (
                        <>
                            {isVocabulary(card) && card.example_sentences && card.example_sentences.length > 0 && (
                                <section className="flex flex-col space-y-4">
                                    <h3 className="font-serif">Example sentences</h3>
                                    {card.example_sentences.map((sentence, index) => (
                                        <SentenceCard key={index} sentence={sentence} hiddenTranslation={false} />
                                    ))}
                                </section>
                            )}
                            {!isVocabulary(card) && card.example_words && card.example_words.length > 0 && (
                                <section className="flex flex-col space-y-4 items-baseline">
                                    <h3 className="font-serif">Example Words</h3>
                                    {card.example_words.map((word, index) => (
                                        <WordCard key={index} word={word} hiddenTranslation={false} hiddenAdditionalInformations={false} />
                                    ))}
                                </section>
                            )}
                            {!isVocabulary(card) && card.example_sentences && card.example_sentences.length > 0 && (
                                <section className="flex flex-col space-y-4 items-baseline">
                                    <h3 className="font-serif">Example Sentences</h3>
                                    {card.example_sentences.map((sentence, index) => (
                                        <SentenceCard key={index} sentence={sentence} hiddenTranslation={false} />
                                    ))}
                                </section>
                            )}
                            <ElementTagsCard element={card} />
                            <ElementSourcesCard element={card} />
                            <ElementPerformanceCard element={card} />
                            {currentIndex < cards.length - 1 ? (
                                <button className="btn btn-primary" onClick={handleGoNext}>
                                    Next
                                </button>
                            ) : (
                                <BackButton>Back to Language</BackButton>
                            )}
                        </>
                    )}
                </>
            )}
        </article>
    );
}
