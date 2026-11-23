"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { updateScoreById } from "@/api/process";
import { skillFor, type Evidence } from "@/utils/skills";
import { completeReview, type ReviewCard } from "@/api/review";
import type Vocabulary from "@/interface/features/Vocabulary";
import type Calligraphy from "@/interface/features/Calligraphy";
import type Exercise from "@/interface/features/Exercise";
import ElementTagsCard from "@/components/elements/elementTagsCard";
import ElementSourcesCard from "@/components/elements/elementSourcesCard";
import ElementPerformanceCard from "@/components/elements/elementPerformanceCard";
import ActionBar, { type ActionResult } from "./ActionBar";
import ReviewHeader from "@/components/elements/reviewHeader";
import RecallGradeButtons from "@/components/ui/buttons/recallGradeButtons";
import BackButton from "@/components/ui/buttons/backButton";
import TierBadge from "@/components/elements/tierBadge";
import HintLadder from "@/components/elements/hintLadder";
import LeechPanel from "@/components/elements/leechPanel";
import { pickReplacement } from "@/utils/replaceCard";
import { suggestedGrade } from "@/utils/cardHints";
import { isExercise, rendererFor } from "./renderers";
import { preloadAhead } from "@/lib/review/lookAhead";
import { clearResume, loadResume, saveResume } from "@/lib/review/resume";
import type { RendererCtx, SessionItem, SessionOptions, ShellState, TypedState } from "./types";
import { Pencil } from "lucide-react";
import EditElementDialog from "./EditElementDialog";
import ReviewDeleteButton from "./ReviewDeleteButton";
import EmptyState from "@/components/ui/emptyState";
import SessionSummary from "./SessionSummary";
import { setReviewSession } from "@/api/apiFetch";

export type { SessionItem, SessionOptions } from "./types";

/** One review session over a queue of cards: header, progress, hint ladder, grading, next/finish, skips, spare replacement, leech panel, streak.
 *  What a card looks like is the renderer's (`rendererFor`); this shell never branches on the element type except for the spare mechanism (spares are exercises). */
export default function ReviewSession({ items, options }: { items: SessionItem[]; options?: SessionOptions }) {
    const cards = items;
    const languageId = options?.languageId;
    const t = useTranslations("elements");
    const tStudy = useTranslations("study");
    const backHref = languageId && options?.finishAction !== "lesson" ? `/languages/${languageId}` : undefined;   // the URL's parent would be the daily review for a scoped queue
    const backLabel = options?.finishAction === "lesson" ? t("backToLesson") : t("backToLanguage");
    const [done, setDone] = useState<string[]>([]);   // finished or skipped cards
    const startTimeRef = useRef<number>(performance.now());
    const [hintUsed, setHintUsed] = useState<boolean>(false);
    const [hiddenTranslation, setHiddenTranslation] = useState<boolean>(true);
    const [graded, setGraded] = useState<boolean>(false);
    const [finishedId, setFinishedId] = useState<string>();   // exercise whose answer is final (solved, out of attempts or given up); a replacing spare has another id
    const [gaveUpId, setGaveUpId] = useState<string>();
    const [result, setResult] = useState<ActionResult | null>(null);       // what the answer did to the card: the strip over Next
    const [typed, setTyped] = useState<TypedState>(null);
    const [typedPending, setTypedPending] = useState(false);        // the result of a typed answer
    const [flipInstead, setFlipInstead] = useState<boolean>(false);
    const [choiceDone, setChoiceDone] = useState<boolean>(false);          // the leech "which one is it" step
    const [hintLevel, setHintLevel] = useState<number>(0);   // hints taken from the ladder (0-2)
    const [flipMs, setFlipMs] = useState<number>(0);          // time from showing the card to flipping it
    const [showPractice, setShowPractice] = useState<boolean>(false);
    const [practiceResult, setPracticeResult] = useState<{ similarity: number; strokeOrderErrors: number } | null>(null);

    const keyOf = (c: ReviewCard) => ("card_id" in c && c.card_id ? String(c.card_id) : c.id!);   // a vocabulary appears once per side
    const queue = cards.filter((c) => !c.spare);                    // spares ride along to replace an exercise the learner can't do
    const [replaced, setReplaced] = useState<Record<string, Exercise>>({});   // queue slot -> the spare exercise standing in
    const [removed, setRemoved] = useState<string[]>([]);           // elements deleted during this session: both sides of a vocabulary go together
    const remaining = queue.filter((c) => !done.includes(keyOf(c)) && !removed.includes(c.id!));
    const slot = remaining[0];
    const currentIndex = done.length;
    const [streak, setStreak] = useState<number | null>(null);
    const [sessionId, setSessionId] = useState(() => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);   // not crypto.randomUUID: it needs https
    useEffect(() => { setReviewSession(sessionId); return () => setReviewSession(undefined); }, [sessionId]);
    const resumeKey = typeof window !== "undefined" && languageId ? window.location.pathname + window.location.search : null;   // language and scope are both in the URL
    useEffect(() => {      // an interrupted review picks up: the cards already answered stay done, and the totals keep one session
        const saved = resumeKey ? loadResume(resumeKey) : null;
        if (!saved) return;
        const here = new Set(queue.map(keyOf));
        const kept = saved.done.filter((id) => here.has(id));
        if (kept.length) { setDone(kept); setSessionId(saved.sessionId); }
    }, []);       // eslint-disable-line react-hooks/exhaustive-deps -- once, on arrival
    const finishedRef = useRef(false);
    const finish = () => {          // the queue's last card was answered: the day counts for the streak, once
        if (finishedRef.current || !languageId || options?.completeOnFinish === false) return;
        finishedRef.current = true;
        completeReview(languageId, queue.length).then((r) => setStreak(r.just_validated ? r.streak : null)).catch(() => { finishedRef.current = false; });
    };
    const againHref = typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined;   // the same queue page, reloaded: a fresh queue
    const last = remaining.length === 1;
    const [edited, setEdited] = useState<Record<string, ReviewCard>>({});   // element id -> its fresh data after an edit made during this session
    const [editing, setEditing] = useState(false);
    const shown = slot && isExercise(slot) && replaced[keyOf(slot)] ? replaced[keyOf(slot)] as ReviewCard : slot;
    const card = shown && edited[shown.id!] ? { ...shown, ...edited[shown.id!] } as ReviewCard : shown;
    const cardDone = graded || (!!card && (finishedId === card.id || gaveUpId === card.id));      // graded, or an exercise whose answer is final
    const ended = (last && cardDone) || (!slot && done.length > 0);      // the session is over: show its totals
    useEffect(() => {
        if (!resumeKey) return;
        if (ended) clearResume(resumeKey);
        else if (done.length) saveResume(resumeKey, { ids: queue.map(keyOf), done, sessionId });
    }, [done, ended]);       // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (ended && typeof window.scrollTo === "function") window.scrollTo({ top: 0 }); }, [ended]);
    useEffect(() => { if (last && cardDone) finish(); });
    useEffect(() => { if (!slot && done.length > 0) finish(); });      // the last card was deleted after others were answered: the session ends here, once
    const [cantHear, setCantHear] = useState<boolean>(false);   // a listen-first card falls back to showing its text

    useEffect(() => { preloadAhead(queue, queue.findIndex((c) => c === slot)); }, [slot]);       // the next two cards' strokes and audio load while this one is worked on
    const renderer = card ? rendererFor(card) : null;
    const autoDraw = !!card && !!renderer?.opensDrawing?.(card);

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
        setResult(null);
        if (autoDraw && card && renderer?.canOpenDrawing) {        // no stroke data for this character: flip it, never a blank canvas
            let stale = false;
            renderer.canOpenDrawing(card).then((ok) => { if (!ok && !stale) setShowPractice(false); });
            return () => { stale = true; };
        }
    }, [currentIndex, card?.id]);

    if (!card || !renderer) {
        return (
            <article className="flex flex-col space-y-6 max-w-2xl mx-auto items-center">
                {ended && <SessionSummary sessionId={sessionId} languageId={languageId} backHref={backHref} backLabel={backLabel} againHref={againHref} />}
                <EmptyState>{t("nothingToReview")}</EmptyState>
                {!ended && <BackButton href={backHref}>{backLabel}</BackButton>}
            </article>
        );
    }

    const handleGrade = (score: number, evidence: Evidence = "self_grade") => {
        setGraded(true);
        const side = renderer.scoreSide?.(card);
        const shownId = card.id;
        Promise.resolve(updateScoreById(card.id, { similarity: score, skill: skillFor(card.id, side), evidence, durationMs: Math.round(performance.now() - startTimeRef.current), hintUsed, side }))
            .then((r) => { if (r && typeof r.score_after === "number" && shownId === card.id) setResult({ before: r.score_before ?? 0, after: r.score_after, level: r.level_after ?? "learning", levelUp: r.level_before !== r.level_after && ["known", "mastered"].includes(r.level_after), capped: !!r.capped }); })
            .catch(() => undefined);
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

    // RC-23: the card's element is gone (no score is written); a spare standing in for the slot ends the slot too.
    const handleDeleted = () => {
        setRemoved([...removed, card.id!]);
        if (card.id !== slot.id) setDone([...done, keyOf(slot)]);
    };

    // Can't do this exercise right now (no audio / mic, or it is broken): another ready one takes its place, else it is skipped.
    const handleReplace = (lacks: "hearing" | "speaking" | null) => {
        const used = new Set(Object.values(replaced).map((r) => r.id!));
        const spare = pickReplacement(cards.filter((c): c is ReviewCard & Exercise => !!c.spare && isExercise(c)), lacks, used);
        if (!spare) return handleGoNext();
        setReplaced({ ...replaced, [keyOf(slot)]: spare });
    };

    const deleteButton = <ReviewDeleteButton key={card.id} elementId={card.id!} onDeleted={handleDeleted} />;
    const state: ShellState = { hiddenTranslation, graded, hintLevel, showPractice, practiceResult, typed, typedPending, flipInstead, choiceDone, cantHear };
    const view = renderer.view(card, state);
    const effectiveLevel = Math.min(2, hintLevel);
    const hintShown = !!view.tier && hiddenTranslation && !showPractice && !view.choiceActive;
    const pickChoice = (correct: boolean) => {
        setChoiceDone(true);
        if (correct) { setHintLevel((l) => Math.max(l, 1)); setHintUsed(true); }       // assisted: the best grade is limited
        else { setHiddenTranslation(false); handleGrade(0, "multiple_choice"); }
    };

    const answered = renderer.whole ? finishedId === card.id || gaveUpId === card.id : graded;   // an element is only edited once its card is done
    const editButton = answered && (
        <button type="button" className="btn btn-secondary min-h-11 inline-flex items-center justify-center gap-2" onClick={() => setEditing(true)}>
            <Pencil size={16} aria-hidden />{t("editButton")}
        </button>
    );


    const ctx: RendererCtx = {
        ...state, ...view, hintShown, item: card, languageId, deleteButton, editButton,
        reveal, pickChoice, effectiveLevel, hintUsed,
        openPractice: () => setShowPractice(true),
        closePractice: () => setShowPractice(false),
        cantHearCard: () => setCantHear(true),
        flipInsteadOfTyping: () => setFlipInstead(true),
        grade: handleGrade,
        elapsedMs: () => Math.round(performance.now() - startTimeRef.current),
        setTyped, setTypedPending,
        showAnswer: () => setHiddenTranslation(false),
        drawingDone: (r) => { setPracticeResult(r); setGraded(true); setShowPractice(false); setHiddenTranslation(false); },   // after a drawing the card shows everything, not its front
        gaveUp: gaveUpId === card.id,
        finished: finishedId === card.id,
        isLast: remaining.length <= 1,
        onExerciseFinished: () => setFinishedId(card.id),
        onGiveUp: () => setGaveUpId(card.id),
        onReplace: handleReplace,
        onNext: handleGoNext,
        onBackFinish: finish,
        backLabel,
    };

    return (
        <article className="flex flex-col space-y-6 max-w-2xl mx-auto">
            {ended && <SessionSummary sessionId={sessionId} languageId={languageId} backHref={backHref} backLabel={backLabel} againHref={againHref} />}      {/* once, on top: the result leads */}
            <ReviewHeader
                kind={tStudy(renderer.kindKey)}
                side={renderer.sideOf?.(card) ? tStudy(renderer.sideOf(card)!) : undefined}
                sectionProgress={card.section ? (() => {
                    const inSection = queue.filter((c) => c.section === card.section);
                    return { done: inSection.findIndex((c) => c === slot) + (graded ? 1 : 0), total: inSection.length };
                })() : undefined}
                sectionLabel={tStudy(renderer.kindKey)}
                current={currentIndex + (graded ? 1 : 0)}
                total={done.length + remaining.length}
                meta={[
                    card.lesson_title ? `${t("lesson")}: ${card.lesson_title}` : "",
                    `${t("created")}: ${new Date(card.created_at).toLocaleDateString()}`,
                    card.last_seen_at ? `${t("lastSeen")}: ${new Date(card.last_seen_at).toLocaleDateString()}` : "",
                ].filter(Boolean)}
                progressLabel={t("reviewProgress")}
                badges={<>{view.tier && <TierBadge tier={view.tier} />}{card.leech && <LeechPanel key={card.id} id={card.id!} leech={card.leech} note={card.note} />}</>}
            />

            {!hintShown && !renderer.whole && <div className="flex items-start justify-end gap-2">{editButton}{deleteButton}</div>}

            {renderer.whole ? renderer.whole(ctx) : (
                <>
                    {renderer.pre?.(ctx)}
                    <div className="flex flex-col gap-2">
                        {hintShown && (
                            <HintLadder card={card as Vocabulary | Calligraphy} level={hintLevel} shown={{ detail: view.showDetail, example: !!view.example }}
                                onHint={() => { setHintLevel((l) => l + 1); setHintUsed(true); }} trailing={deleteButton}>{renderer.hintExtra?.(ctx)}</HintLadder>
                        )}
                        {renderer.body?.(ctx)}
                    </div>

                    {renderer.escape?.(ctx)}

                    {/* grade buttons: the pinned bar at the end of this article (hidden while drawing; "I can't draw" brings them back) */}
                    {/* ── Post-grade content ───────────────────────── */}
                    {graded && (
                        <>
                            {renderer.post?.(ctx)}
                            <ElementTagsCard element={card} />
                            <ElementSourcesCard element={card} />
                            <ElementPerformanceCard element={card} />
                        </>
                    )}
                </>
            )}
            {editing && <EditElementDialog card={card} languageId={languageId ?? window.location.pathname.split("/")[2]}
                onSaved={(fresh) => setEdited((e) => ({ ...e, [fresh.id!]: fresh }))} onClose={() => setEditing(false)} />}
            {streak !== null && <p className="callout" role="status">{tStudy("reviewStreakValidated", { count: streak })}</p>}
            {/* last child, so it sticks to the bottom of the screen like the forms' Save bar; the last card's way out is the end screen's bar */}
            {!renderer.whole && !hiddenTranslation && !graded && !showPractice && (
                <ActionBar phase="grade"><RecallGradeButtons onGrade={handleGrade} suggested={view.tier ? suggestedGrade(flipMs, effectiveLevel) : undefined} /></ActionBar>
            )}
            {!renderer.whole && graded && remaining.length > 1 && <ActionBar phase="next" onNext={handleGoNext} result={result} />}
        </article>
    );
}
