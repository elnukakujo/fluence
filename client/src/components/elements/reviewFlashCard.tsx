"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { updateScoreById } from "@/api/process";
import { submitCalligraphyDrawing } from "@/api/calligraphy";
import CalligraphyPracticeCanvas, { guidanceFor } from "./calligraphyPracticeCanvas";
import { loadStrokeData } from "@/lib/calligraphy/strokeData";
import { isDrawFirst } from "@/utils/drawFirst";
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
import RunnerBoundary from "@/components/exercises/runnerBoundary";
import ReviewHeader from "./reviewHeader";
import ExerciseFooter from "@/components/exercises/exerciseFooter";
import RecallGradeButtons from "@/components/ui/buttons/recallGradeButtons";
import BackButton from "@/components/ui/buttons/backButton";
import TierBadge from "./tierBadge";
import { EarOff, PenLine, PenOff } from "lucide-react";
import HintLadder from "./hintLadder";
import TypeAnswer from "./typeAnswer";
import LeechPanel from "./leechPanel";
import LeechChoice from "./leechChoice";
import AudioPlayer from "@/components/media/audioPlayer";
import { PUBLIC_BASE_URL } from "@/api";
import { pickReplacement } from "@/utils/replaceCard";
import { isListenFirst } from "@/utils/listenFirst";
import { gradeForTyped, gradeFromCloseness, matchesAnswer } from "@/utils/typedAnswer";
import { scoreTypedAnswer } from "@/api/process";
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
    const [finishedId, setFinishedId] = useState<string>();   // exercise whose answer is final (solved, out of attempts or given up); a replacing spare has another id
    const [gaveUpId, setGaveUpId] = useState<string>();
    const [typed, setTyped] = useState<{ correct: boolean; diff?: number[] } | null>(null);
    const [typedPending, setTypedPending] = useState(false);        // the result of a typed answer
    const [flipInstead, setFlipInstead] = useState<boolean>(false);
    const [choiceDone, setChoiceDone] = useState<boolean>(false);          // the leech "which one is it" step
    const [hintLevel, setHintLevel] = useState<number>(0);   // hints taken from the ladder (0-2)
    const [flipMs, setFlipMs] = useState<number>(0);          // time from showing the card to flipping it
    const [showPractice, setShowPractice] = useState<boolean>(false);
    const [practiceResult, setPracticeResult] = useState<{ similarity: number; strokeOrderErrors: number } | null>(null);
    const tCal = useTranslations("calligraphy");
    const tStudy = useTranslations("study");

    const keyOf = (c: ReviewCard) => ("card_id" in c && c.card_id ? String(c.card_id) : c.id!);   // a vocabulary appears once per side
    const queue = cards.filter((c) => !c.spare);                    // spares ride along to replace an exercise the learner can't do
    const [replaced, setReplaced] = useState<Record<string, Exercise>>({});   // queue slot -> the spare exercise standing in
    const remaining = queue.filter((c) => !done.includes(keyOf(c)));
    const slot = remaining[0];
    const currentIndex = done.length;
    const [streak, setStreak] = useState<number | null>(null);
    const finishedRef = useRef(false);
    const finish = () => {          // the queue's last card was answered: the day counts for the streak, once
        if (finishedRef.current || !languageId) return;
        finishedRef.current = true;
        completeReview(languageId, queue.length).then((r) => setStreak(r.validated ? r.streak : null)).catch(() => { finishedRef.current = false; });
    };
    const last = remaining.length === 1;
    useEffect(() => { if (last && graded) finish(); });
    const card = slot && isExercise(slot) && replaced[keyOf(slot)] ? replaced[keyOf(slot)] as ReviewCard : slot;
    const [cantHear, setCantHear] = useState<boolean>(false);   // a listen-first card falls back to showing its text

    const calTier = card && isCalligraphy(card) ? tierOf(card as unknown as Parameters<typeof tierOf>[0]) : null;
    // A strong character is always drawn; on other days a stable third of the weaker ones is, instead of the flip card.
    const autoDraw = !!card && !!calTier && (calTier === "maintaining" || isDrawFirst(card, calTier, new Date()));

    useEffect(() => {
        startTimeRef.current = performance.now();
        setHintUsed(false);
        setHiddenTranslation(true);
        setGraded(false);
        setHintLevel(0);
        setFlipMs(0);
        setTyped(null);
        setFlipInstead(false);
        setChoiceDone(false);
        setShowPractice(autoDraw);
        setPracticeResult(null);
        setCantHear(false);
        if (autoDraw && card && isCalligraphy(card)) {        // no stroke data for this character: flip it, never a blank canvas
            let stale = false;
            loadStrokeData(card.character.character ?? "").then((s) => { if (!s && !stale) setShowPractice(false); }).catch(() => { if (!stale) setShowPractice(false); });
            return () => { stale = true; };
        }
    }, [currentIndex, card?.id]);

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
            await submitCalligraphyDrawing(card.id, r.similarity, r.strokeOrderErrors, duration_ms, hintUsed || guidanceFor(tier!) !== "none");      // a shown guide counts as a hint
            setPracticeResult(r);
            setGraded(true);
            setShowPractice(false);
            setHiddenTranslation(false);        // after a drawing the card shows everything, not its front
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
        setDone([...done, keyOf(slot)]);
    };

    // Can't do this exercise right now (no audio / mic, or it is broken): another ready one takes its place, else it is skipped.
    const handleReplace = (lacks: "hearing" | "speaking" | null) => {
        const used = new Set(Object.values(replaced).map((r) => r.id!));
        const spare = pickReplacement(cards.filter((c): c is ReviewCard & Exercise => !!c.spare && isExercise(c)), lacks, used);
        if (!spare) return handleGoNext();
        setReplaced({ ...replaced, [keyOf(slot)]: spare });
    };

    const practiceButton = <button type="button" className="btn btn-secondary btn-sm min-h-11 inline-flex items-center gap-1.5" onClick={() => setShowPractice(true)}><PenLine size={14} aria-hidden />{tCal("practiceButton")}</button>;
    const tier = isVocabulary(card) || isCalligraphy(card) ? tierOf(card as unknown as Parameters<typeof tierOf>[0]) : null;
    const scaffolds = tier ? scaffoldsFor(tier) : null;
    const showDetail = scaffolds?.detail === "shown";                        // phonetic (vocabulary) / strokes and radical (calligraphy) on the front
    const listenFirst = !!tier && isVocabulary(card) && isListenFirst(card, tier, new Date()) && !cantHear;        // hear the clip before seeing the word
    const example = isVocabulary(card) && scaffolds?.example && card.side !== "back" ? card.example_sentences?.[0] : undefined;   // never on the back side: the sentence contains the answer
    const effectiveLevel = Math.min(2, hintLevel);
    const choiceActive = isVocabulary(card) && !!card.leech?.confusable && !choiceDone && hiddenTranslation && !graded;
    const hintShown = !!tier && hiddenTranslation && !showPractice && !choiceActive;
    const pickChoice = (correct: boolean) => {
        setChoiceDone(true);
        if (correct) { setHintLevel((l) => Math.max(l, 1)); setHintUsed(true); }       // assisted: the best grade is limited
        else { setHiddenTranslation(false); handleGrade(0); }
    };
    const typedMode = tier === "maintaining" && isVocabulary(card) && card.side === "back" && !flipInstead;
    const answerTyped = async (value: string | null) => {          // null = gave up
        if (!isVocabulary(card)) return;
        const correct = value !== null && matchesAnswer(value, card.word);
        const ms = Math.round(performance.now() - startTimeRef.current);        // taken at submit: the request's latency never changes the speed bonus
        let grade = gradeForTyped(correct, ms), diff: number[] | undefined;
        if (value !== null && !correct && card.word.word) {            // a miss may still be close: graded by character closeness (a failed request keeps the exact-match grade)
            setTypedPending(true);
            try {
                const r = await scoreTypedAnswer(value, card.word.word, languageId);
                grade = gradeFromCloseness(r.closeness, ms);
                diff = r.diff;
            } catch { /* exact-match grade */ }
            setTypedPending(false);
        }
        setTyped({ correct, diff: grade > 0 ? diff : undefined });
        setHiddenTranslation(false);
        handleGrade(Math.min(grade, HINT_CAPS[effectiveLevel]));
    };

    return (
        <article className="flex flex-col space-y-6 max-w-2xl mx-auto">
            <ReviewHeader
                kind={tStudy(kindKey(card))}
                side={isVocabulary(card) && card.side ? tStudy(card.side) : undefined}
                sectionProgress={card.section ? (() => {
                    const inSection = queue.filter((c) => c.section === card.section);
                    return { done: inSection.findIndex((c) => c === slot) + (graded ? 1 : 0), total: inSection.length };
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
                badges={tier && !showPractice ? <TierBadge tier={tier} /> : undefined}
            />

            {isExercise(card) ? (
                // Exercises are interactive practice, not flip-cards.
                <>
                    <RunnerBoundary key={card.id} exerciseId={card.id} onSkip={() => handleReplace(null)} message={t("exerciseBroken")} skipLabel={t("skipBroken")}><ExerciseRunner exercise={card} gaveUp={gaveUpId === card.id} onFinished={() => setFinishedId(card.id)} /></RunnerBoundary>
                    <ExerciseFooter exercise={card} finished={gaveUpId === card.id || finishedId === card.id} isLast={remaining.length <= 1}
                        onGiveUp={() => setGaveUpId(card.id)} onSkip={handleReplace} onNext={handleGoNext}
                        last={<BackButton onBefore={finish}>{t("backToLanguage")}</BackButton>} />
                </>
            ) : (
                <>
                    {/* ── Calligraphy: draw the character (stroke order + similarity) ── */}
                    {isCalligraphy(card) && !showPractice && !hintShown && practiceButton}
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
                    <div className="flex flex-col gap-2">
                    {hintShown && (
                        <HintLadder card={card as Vocabulary | Calligraphy} level={hintLevel} shown={{ detail: showDetail, example: !!example }}
                            onHint={() => { setHintLevel((l) => l + 1); setHintUsed(true); }}>{isCalligraphy(card) && practiceButton}</HintLadder>
                    )}
                    {isCalligraphy(card) && showPractice ? (
                        <CalligraphyPracticeCanvas character={card.character.character ?? ""} tier={tier!} onResult={handleDrawingResult}
                            info={tier === "learning" ? <CharacterCard character={card.character} hiddenTranslation={false} hiddenAdditionalInformations={false} /> : undefined} />
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
                            <TypeAnswer pending={typedPending} onSubmit={answerTyped} onGiveUp={() => answerTyped(null)} onFlip={() => setFlipInstead(true)} />
                        ) : typed && (
                            typed.diff ? (
                                <p role="status" className="font-medium">
                                    {t("typeClose")}{" "}
                                    <span aria-label={t("typeDiffLabel", { chars: [...(card.word.word ?? "")].filter((_, i) => typed.diff!.includes(i)).join(" ") })}>
                                        {[...(card.word.word ?? "")].map((c, i) => typed.diff!.includes(i) ? <u key={i} className="font-bold">{c}</u> : c)}
                                    </span>
                                </p>
                            ) : (
                                <p role="status" className="font-medium">{typed.correct ? t("typeRight") : t("typeWrong", { word: card.word.word ?? "" })}</p>
                            )
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
                                    listenFirst ? <>
                                        <p className="text-center text-lg font-medium">{t("listenPrompt")}</p>
                                        {/* on the card, front side only (the back side asks for the word, the clip would give it away); playing must not flip the card */}
                                        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}><AudioPlayer src={PUBLIC_BASE_URL + card.word.audio_files![0]} /></div>
                                    </> : <>
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
                    </div>

                    {/* a listen-first card: the escape sits below the card, like the skip buttons under an exercise */}
                    {listenFirst && hiddenTranslation && !graded && (
                        <div className="flex flex-wrap items-center gap-2">
                            <button type="button" className="btn btn-secondary inline-flex items-center gap-2 min-h-11" onClick={() => setCantHear(true)}><EarOff size={16} aria-hidden />{t("cantHearCard")}</button>
                        </div>
                    )}

                    {/* a drawn calligraphy card: the escape sits below the card, like "I can't hear" */}
                    {isCalligraphy(card) && showPractice && !graded && (
                        <div className="flex flex-wrap items-center gap-2">
                            <button type="button" className="btn btn-secondary inline-flex items-center gap-2 min-h-11" onClick={() => setShowPractice(false)}><PenOff size={16} aria-hidden />{tCal("cantDraw")}</button>
                        </div>
                    )}

                    {/* ── Grade buttons ────────────────────────────── */}
                    {!hiddenTranslation && !graded && (
                        <RecallGradeButtons onGrade={handleGrade} suggested={tier ? suggestedGrade(flipMs, effectiveLevel) : undefined} />
                    )}

                    {/* ── Post-grade content ───────────────────────── */}
                    {graded && (
                        <>
                            {/* next first: the details below can be long, the action must stay in view */}
                            {remaining.length > 1 ? (
                                <button className="btn btn-primary min-h-11 w-full" onClick={handleGoNext} autoFocus>
                                    {t("nextButton")}
                                </button>
                            ) : (
                                <BackButton onBefore={finish}>{t("backToLanguage")}</BackButton>
                            )}
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
                        </>
                    )}
                </>
            )}
            {streak !== null && <p className="callout" role="status">{tStudy("reviewStreakValidated", { count: streak })}</p>}
        </article>
    );
}
