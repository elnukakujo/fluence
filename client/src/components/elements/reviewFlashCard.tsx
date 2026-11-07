"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { updateScoreById } from "@/api/process";
import { submitCalligraphyDrawing } from "@/api/calligraphy";
import CalligraphyPracticeCanvas from "./calligraphyPracticeCanvas";
import type Vocabulary from "@/interface/features/Vocabulary";
import type Grammar from "@/interface/features/Grammar";
import type Calligraphy from "@/interface/features/Calligraphy";
import type Exercise from "@/interface/features/Exercise";
import { completeReview, type ReviewCard } from "@/api/review";
import WordCard from "./wordCard";
import GrammarCard from "./grammarCard";
import CharacterCard from "./characterCard";
import SentenceCard from "./sentenceCard";
import ElementTagsCard from "./elementTagsCard";
import ElementSourcesCard from "./elementSourcesCard";
import ElementPerformanceCard from "./elementPerformanceCard";
import ExerciseRunner from "@/components/exercises/exerciseRunner";
import ReviewHeader from "./reviewHeader";
import SkipButtons from "@/components/exercises/skipButtons";
import RecallGradeButtons from "@/components/ui/buttons/recallGradeButtons";
import BackButton from "@/components/ui/buttons/backButton";
import TierBadge from "./tierBadge";
import HintLadder from "./hintLadder";
import TypeAnswer from "./typeAnswer";
import LeechPanel from "./leechPanel";
import LeechChoice from "./leechChoice";
import { gradeForTyped, matchesAnswer } from "@/utils/typedAnswer";
import { HINT_CAPS, suggestedGrade } from "@/utils/cardHints";
import { scaffoldsFor, tierOf } from "@/utils/cardTier";

const isVocabulary = (c: ReviewCard): c is Vocabulary => "word" in c;
const isGrammar = (c: ReviewCard): c is Grammar => "title" in c;
const isCalligraphy = (c: ReviewCard): c is Calligraphy => "character" in c;
const isExercise = (c: ReviewCard): c is Exercise => "exercise_type" in c;

const kindKey = (c: ReviewCard) =>
    isVocabulary(c) ? "section_voc" : isGrammar(c) ? "section_gram" : isCalligraphy(c) ? "section_call" : "section_ex";

export default function ReviewFlashCard({ cards, languageId }: { cards: ReviewCard[]; languageId?: string }) {
    const t = useTranslations("elements");
    const [done, setDone] = useState<string[]>([]);   // finished or skipped cards
    const startTimeRef = useRef<number>(performance.now());
    const [hintUsed, setHintUsed] = useState<boolean>(false);
    const [hiddenTranslation, setHiddenTranslation] = useState<boolean>(true);
    const [graded, setGraded] = useState<boolean>(false);
    const [peeked, setPeeked] = useState<boolean>(false);
    const [typed, setTyped] = useState<{ correct: boolean } | null>(null);        // the result of a typed answer
    const [flipInstead, setFlipInstead] = useState<boolean>(false);
    const [choiceDone, setChoiceDone] = useState<boolean>(false);          // the leech "which one is it" step
    const [hintLevel, setHintLevel] = useState<number>(0);   // hints taken from the ladder (0-2)
    const [flipMs, setFlipMs] = useState<number>(0);          // time from showing the card to flipping it
    const [showPractice, setShowPractice] = useState<boolean>(false);
    const [practiceResult, setPracticeResult] = useState<{ similarity: number; strokeOrderErrors: number } | null>(null);
    const tCal = useTranslations("calligraphy");
    const tStudy = useTranslations("study");

    const keyOf = (c: ReviewCard) => ("card_id" in c && c.card_id ? String(c.card_id) : c.id!);   // a vocabulary appears once per side
    const remaining = cards.filter((c) => !done.includes(keyOf(c)));
    const currentIndex = done.length;
    const [streak, setStreak] = useState<number | null>(null);
    const finishedRef = useRef(false);
    const finish = () => {          // the queue's last card was answered: the day counts for the streak, once
        if (finishedRef.current || !languageId) return;
        finishedRef.current = true;
        completeReview(languageId, cards.length).then((r) => setStreak(r.validated ? r.streak : null)).catch(() => { finishedRef.current = false; });
    };
    const last = remaining.length === 1;
    useEffect(() => { if (last && graded) finish(); });
    const card = remaining[0];

    const autoDraw = !!card && isCalligraphy(card) && tierOf(card as unknown as Parameters<typeof tierOf>[0]) === "maintaining";   // a strong character is drawn, not flipped

    useEffect(() => {
        startTimeRef.current = performance.now();
        setHintUsed(false);
        setHiddenTranslation(true);
        setGraded(false);
        setPeeked(false);
        setHintLevel(0);
        setFlipMs(0);
        setTyped(null);
        setFlipInstead(false);
        setChoiceDone(false);
        setShowPractice(autoDraw);
        setPracticeResult(null);
    }, [currentIndex]);

    if (!card) {
        return (
            <article className="flex flex-col space-y-6 max-w-2xl mx-auto items-center">
                <p className="text-muted">{t("nothingToReview")}</p>
                <BackButton>{t("backToLanguage")}</BackButton>
            </article>
        );
    }

    const handleGrade = (score: number) => {
        setGraded(true);
        const duration_ms = Math.round(performance.now() - startTimeRef.current);
        updateScoreById(card.id, score, duration_ms, hintUsed, undefined, isVocabulary(card) ? card.side ?? "front" : undefined);
    };

    const handleDrawingResult = async (r: { similarity: number; strokeOrderErrors: number }) => {
        const duration_ms = Math.round(performance.now() - startTimeRef.current);
        try {
            await submitCalligraphyDrawing(card.id, r.similarity, r.strokeOrderErrors, duration_ms);
            setPracticeResult(r);
            setGraded(true);
            setShowPractice(false);
        } catch (e) {
            console.error("Failed to submit drawing", e);
        }
    };

    const reveal = () => {
        if (!hiddenTranslation) return;
        setFlipMs(Math.round(performance.now() - startTimeRef.current));
        setHiddenTranslation(false);
        setHintUsed(true);
    };

    const handleGoNext = () => {
        setDone([...done, keyOf(card)]);
    };

    const tier = isVocabulary(card) || isCalligraphy(card) ? tierOf(card as unknown as Parameters<typeof tierOf>[0]) : null;
    const scaffolds = tier ? scaffoldsFor(tier) : null;
    const showDetail = scaffolds?.detail === "shown" || peeked;                        // phonetic (vocabulary) / strokes and radical (calligraphy) on the front
    const example = isVocabulary(card) && scaffolds?.example ? card.example_sentences?.[0] : undefined;
    const peek = () => { setPeeked(true); setHintUsed(true); };
    const effectiveLevel = Math.min(2, Math.max(hintLevel, peeked ? 1 : 0));            // a peek counts as the first hint
    const choiceActive = isVocabulary(card) && !!card.leech?.confusable && !choiceDone && hiddenTranslation && !graded;
    const pickChoice = (correct: boolean) => {
        setChoiceDone(true);
        if (correct) { setHintLevel((l) => Math.max(l, 1)); setHintUsed(true); }       // assisted: the best grade is limited
        else { setHiddenTranslation(false); handleGrade(0); }
    };
    const typedMode = tier === "maintaining" && isVocabulary(card) && card.side === "back" && !flipInstead;
    const answerTyped = (value: string | null) => {          // null = gave up
        if (!isVocabulary(card)) return;
        const correct = value !== null && matchesAnswer(value, card.word);
        const ms = Math.round(performance.now() - startTimeRef.current);
        setTyped({ correct });
        setHiddenTranslation(false);
        handleGrade(Math.min(gradeForTyped(correct, ms), HINT_CAPS[effectiveLevel]));
    };

    return (
        <article className="flex flex-col space-y-6 max-w-2xl mx-auto">
            <ReviewHeader
                kind={tStudy(kindKey(card))}
                side={isVocabulary(card) && card.side ? tStudy(card.side) : undefined}
                sectionProgress={card.section ? (() => {
                    const inSection = cards.filter((c) => c.section === card.section);
                    return { done: inSection.findIndex((c) => c === card) + (graded ? 1 : 0), total: inSection.length };
                })() : undefined}
                sectionLabel={tStudy(kindKey(card))}
                current={currentIndex + (graded ? 1 : 0)}
                total={done.length + remaining.length}
                meta={[
                    card.lesson_title ? `${t("lesson")}: ${card.lesson_title}` : "",
                    `${t("created")}: ${new Date(card.created_at).toLocaleDateString()}`,
                    card.last_seen_at ? `${t("lastSeen")}: ${new Date(card.last_seen_at).toLocaleDateString()}` : "",
                ].filter(Boolean)}
                progressLabel={t("reviewProgress")}
            />

            {isExercise(card) ? (
                // Exercises are interactive practice, not flip-cards.
                <>
                    <ExerciseRunner key={card.id} exercise={card} />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <SkipButtons exercise={card} onSkip={handleGoNext} />
                        {remaining.length > 1 ? (
                            <button className="btn btn-primary ml-auto" onClick={handleGoNext}>
                                {t("nextButton")}
                            </button>
                        ) : (
                            <BackButton onBefore={finish}>{t("backToLanguage")}</BackButton>
                        )}
                    </div>
                </>
            ) : (
                <>
                    {/* ── Calligraphy: draw the character (stroke order + similarity) ── */}
                    {isCalligraphy(card) && !showPractice && (
                        <button className="btn self-end" onClick={() => setShowPractice(true)}>{tCal("practiceButton")}</button>
                    )}
                    {isCalligraphy(card) && practiceResult && (
                        <section className="card flex flex-col gap-2.5">
                            <h3 className="font-serif">{tCal("practiceResult")}</h3>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted">{tCal("shapeSimilarity")}</span>
                                <span className="stat-value">{Math.round(practiceResult.similarity * 100)}%</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted">{tCal("strokeOrder")}</span>
                                <span className="text-sm font-medium">
                                    {practiceResult.strokeOrderErrors === 0 ? tCal("strokeOrderCorrect") : tCal("strokeOrderErrors", { n: practiceResult.strokeOrderErrors })}
                                </span>
                            </div>
                        </section>
                    )}
                    {card.leech && <LeechPanel key={card.id} id={card.id!} leech={card.leech} note={card.note} />}
                    {tier && !showPractice && <TierBadge tier={tier} />}
                    {isCalligraphy(card) && showPractice ? (
                        <CalligraphyPracticeCanvas character={card.character.character ?? ""} difficulty={card.difficulty} onResult={handleDrawingResult} />
                    ) : choiceActive && isVocabulary(card) && card.leech?.confusable ? (
                    (() => {
                        const other = card.leech!.confusable!, back = card.side === "back";
                        const options = [{ label: (back ? card.word.word : card.word.translation) ?? "", correct: true }, { label: back ? other.word : other.translation, correct: false }];
                        const flipped = [...card.id!].reduce((a, c) => a + c.charCodeAt(0), 0) % 2 === 1;      // stable per card, so the right one is not always first
                        return <LeechChoice prompt={back ? t("chooseWord", { translation: card.word.translation ?? "" }) : t("chooseMeaning", { word: card.word.word ?? "" })}
                            options={flipped ? options.reverse() : options} onPick={pickChoice} />;
                    })()
                    ) : typedMode && isVocabulary(card) ? (
                    <section className="flex flex-col gap-3">
                        <WordCard word={card.word} hiddenTranslation={hiddenTranslation} hiddenAdditionalInformations={false} reverse showPhonetic={showDetail} />
                        {hiddenTranslation ? (
                            <TypeAnswer onSubmit={answerTyped} onGiveUp={() => answerTyped(null)} onFlip={() => setFlipInstead(true)} />
                        ) : typed && (
                            <p role="status" className="font-medium">{typed.correct ? t("typeRight") : t("typeWrong", { word: card.word.word ?? "" })}</p>
                        )}
                    </section>
                    ) : (
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
                                    <>
                                        <WordCard word={card.word} hiddenTranslation={true} hiddenAdditionalInformations={false} reverse={card.side === "back"} showPhonetic={showDetail} />
                                        {example && <SentenceCard sentence={example} hiddenTranslation={true} />}
                                    </>
                                )}
                                {isGrammar(card) && (
                                    <h3 className="font-serif">{card.title}</h3>
                                )}
                                {isCalligraphy(card) && (
                                    <>
                                        <h3 className="font-serif">{t("characterHeading")}</h3>
                                        <CharacterCard character={card.character} hiddenTranslation={true} hiddenAdditionalInformations={showDetail} />
                                    </>
                                )}
                                <p className="text-sm text-muted text-center mt-3">{t("clickToReveal")}</p>
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

                    )}

                    {scaffolds?.detail === "peek" && !peeked && hiddenTranslation && !showPractice && !choiceActive && (
                        <button type="button" className="btn btn-secondary min-h-11 self-start" onClick={peek}>{t("peek")}</button>
                    )}

                    {tier && hiddenTranslation && !showPractice && !choiceActive && (
                        <HintLadder card={card as Vocabulary | Calligraphy} level={hintLevel} onHint={() => { setHintLevel((l) => l + 1); setHintUsed(true); }} />
                    )}

                    {/* ── Grade buttons ────────────────────────────── */}
                    {!hiddenTranslation && !graded && (
                        <RecallGradeButtons onGrade={handleGrade} maxScore={HINT_CAPS[effectiveLevel]} suggested={tier ? suggestedGrade(flipMs, effectiveLevel) : undefined} />
                    )}

                    {/* ── Post-grade content ───────────────────────── */}
                    {graded && (
                        <>
                            {isVocabulary(card) && card.example_sentences && card.example_sentences.length > 0 && (
                                <section className="flex flex-col space-y-4">
                                    <h3 className="font-serif">{t("exampleSentences", { ns: "vocabulary" })}</h3>
                                    {card.example_sentences.map((sentence, index) => (
                                        <SentenceCard key={index} sentence={sentence} hiddenTranslation={false} />
                                    ))}
                                </section>
                            )}
                            {!isVocabulary(card) && card.example_words && card.example_words.length > 0 && (
                                <section className="flex flex-col space-y-4 items-baseline">
                                    <h3 className="font-serif">{t("exampleWords", { ns: "grammar" })}</h3>
                                    {card.example_words.map((word, index) => (
                                        <WordCard key={index} word={word} hiddenTranslation={false} hiddenAdditionalInformations={false} />
                                    ))}
                                </section>
                            )}
                            {!isVocabulary(card) && card.example_sentences && card.example_sentences.length > 0 && (
                                <section className="flex flex-col space-y-4 items-baseline">
                                    <h3 className="font-serif">{t("exampleSentences", { ns: "grammar" })}</h3>
                                    {card.example_sentences.map((sentence, index) => (
                                        <SentenceCard key={index} sentence={sentence} hiddenTranslation={false} />
                                    ))}
                                </section>
                            )}
                            <ElementTagsCard element={card} />
                            <ElementSourcesCard element={card} />
                            <ElementPerformanceCard element={card} />
                            {remaining.length > 1 ? (
                                <button className="btn btn-primary" onClick={handleGoNext}>
                                    {t("nextButton")}
                                </button>
                            ) : (
                                <BackButton onBefore={finish}>{t("backToLanguage")}</BackButton>
                            )}
                        </>
                    )}
                </>
            )}
            {streak !== null && <p className="callout" role="status">{tStudy("reviewStreakValidated", { count: streak })}</p>}
        </article>
    );
}
