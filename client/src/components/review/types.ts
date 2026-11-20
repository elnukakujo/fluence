import type { ReactNode } from "react";
import type { ReviewCard } from "@/api/review";
import type { Tier } from "@/utils/cardTier";
import type { Evidence } from "@/utils/skills";

export type SessionItem = ReviewCard;

export type SessionOptions = {
    languageId?: string;
    /** Validate the streak day when the queue's last card is answered. Default: on whenever `languageId` is given (today's daily review). */
    completeOnFinish?: boolean;
    /** Where the last card leads: back to the language (daily review, default) or back to the lesson (lesson study). */
    finishAction?: "language" | "lesson";
};

export type TypedState = { correct: boolean; diff?: number[] } | null;

/** The shell's per-card state that renderers read (the shell owns it; renderers never set it directly). */
export type ShellState = {
    hiddenTranslation: boolean;
    graded: boolean;
    hintLevel: number;
    showPractice: boolean;
    practiceResult: { similarity: number; strokeOrderErrors: number } | null;
    typed: TypedState;
    typedPending: boolean;
    flipInstead: boolean;
    choiceDone: boolean;
    cantHear: boolean;
};

/** What a renderer derives from its item and the shell state (tier-dependent presentation flags). */
export type ItemView = {
    tier: Tier | null;
    showDetail: boolean;          // phonetic / strokes shown on the front
    example?: unknown;            // the example sentence shown on a vocabulary front
    listenFirst: boolean;
    choiceActive: boolean;        // the leech "which one is it" step
    typedMode: boolean;           // maintaining-tier vocabulary back: type the word
};

/** Everything a slot function may use: the item, shell state, derived view and the shell's callbacks. */
export type RendererCtx<T extends SessionItem = SessionItem> = ShellState & ItemView & {
    deleteButton?: ReactNode;                         // the session's Delete, for a renderer that lays it out itself (`whole`)
    item: T;
    hintShown: boolean;           // the hint ladder is on screen (shell: tier set, card hidden, not drawing, no leech choice)
    reveal(): void;
    openPractice(): void;
    closePractice(): void;
    cantHearCard(): void;
    flipInsteadOfTyping(): void;
    pickChoice(correct: boolean): void;
    languageId?: string;
    // primitives the renderers use for their own type-specific handlers (typed answer, drawing)
    grade(score: number, evidence?: Evidence): void;  // post the score (evidence defaults to self_grade) and mark the card graded
    elapsedMs(): number;                              // since the card was shown
    hintUsed: boolean;
    effectiveLevel: number;                           // hint level capped at 2
    setTyped(t: TypedState): void;
    setTypedPending(b: boolean): void;
    showAnswer(): void;                               // reveal without counting as a hint
    drawingDone(r: { similarity: number; strokeOrderErrors: number }): void;
    // exercises
    gaveUp: boolean;
    finished: boolean;
    isLast: boolean;
    onExerciseFinished(): void;
    onGiveUp(): void;
    onReplace(lacks: "hearing" | "speaking" | null): void;
    onNext(): void;
    onBackFinish(): void;
    backLabel: string;            // the finish button's label (back to the language / the lesson)
};

/** One element kind's presentation. `whole` replaces the flip-card layout (exercises); the other slots keep the flip-card's DOM order. */
export type ItemRenderer<T extends SessionItem = SessionItem> = {
    kindKey: string;                                  // study.section_*
    sideOf?(item: T): string | undefined;             // study.<side> label key (header)
    view(item: T, s: ShellState): ItemView;
    scoreSide?(item: T): "front" | "back" | undefined;   // the side a score is posted for (vocabulary only)
    opensDrawing?(item: T): boolean;                  // calligraphy: a strong / drawn-first card opens on the canvas
    canOpenDrawing?(item: T): Promise<boolean>;       // ... unless there is no stroke data for it: then it is flipped, never a blank canvas
    pre?(ctx: RendererCtx<T>): ReactNode;             // above the leech panel
    hintExtra?(ctx: RendererCtx<T>): ReactNode;       // child of the hint ladder
    body?(ctx: RendererCtx<T>): ReactNode;
    escape?(ctx: RendererCtx<T>): ReactNode;          // "I can't hear" / "I can't draw", below the card
    post?(ctx: RendererCtx<T>): ReactNode;           // type-specific content after grading
    whole?(ctx: RendererCtx<T>): ReactNode;          // exercises: runner + footer instead of a flip card
};
