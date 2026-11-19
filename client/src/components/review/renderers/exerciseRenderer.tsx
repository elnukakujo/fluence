import { useTranslations } from "next-intl";
import type Exercise from "@/interface/features/Exercise";
import ExerciseRunner from "@/components/exercises/exerciseRunner";
import RunnerBoundary from "@/components/exercises/runnerBoundary";
import ExerciseFooter from "@/components/exercises/exerciseFooter";
import LinkedGrammarSheet from "@/components/exercises/linkedGrammarSheet";
import { lastAttempt } from "@/components/exercises/creditExercise";
import BackButton from "@/components/ui/buttons/backButton";
import type { ItemRenderer, RendererCtx } from "../types";

/** The linked grammar's sheet once the attempt is over (failed, given up, hint) or while the grammar is still hard (RC-22). */
function GrammarSheet({ exercise, done, gaveUp }: { exercise: Exercise; done: boolean; gaveUp: boolean }) {
    const attempt = done ? lastAttempt(exercise.id!) : null;
    return <LinkedGrammarSheet grammarIds={exercise.related_grammar ?? []} failed={gaveUp || !!attempt?.failed} hintUsed={!!attempt?.hintUsed} />;
}

// Exercises are interactive practice, not flip-cards.
function ExerciseBody({ c }: { c: RendererCtx<Exercise> }) {
    const t = useTranslations("elements");
    return (
        <>
            <RunnerBoundary key={c.item.id} exerciseId={c.item.id} onSkip={() => c.onReplace(null)} message={t("exerciseBroken")} skipLabel={t("skipBroken")}>
                <ExerciseRunner exercise={c.item} gaveUp={c.gaveUp} onFinished={c.onExerciseFinished} />
            </RunnerBoundary>
            <GrammarSheet exercise={c.item} done={c.gaveUp || c.finished} gaveUp={c.gaveUp} />
            <ExerciseFooter exercise={c.item} finished={c.gaveUp || c.finished} isLast={c.isLast}
                onGiveUp={c.onGiveUp} onSkip={c.onReplace} onNext={c.onNext}
                last={<BackButton onBefore={c.onBackFinish}>{c.backLabel}</BackButton>} />
        </>
    );
}

export const exerciseRenderer: ItemRenderer<Exercise> = {
    kindKey: "section_ex",
    view: () => ({ tier: null, showDetail: false, listenFirst: false, choiceActive: false, typedMode: false }),
    whole: (c) => <ExerciseBody c={c} />,
};
