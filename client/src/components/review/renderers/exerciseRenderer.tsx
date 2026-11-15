import { useTranslations } from "next-intl";
import type Exercise from "@/interface/features/Exercise";
import ExerciseRunner from "@/components/exercises/exerciseRunner";
import RunnerBoundary from "@/components/exercises/runnerBoundary";
import ExerciseFooter from "@/components/exercises/exerciseFooter";
import BackButton from "@/components/ui/buttons/backButton";
import type { ItemRenderer, RendererCtx } from "../types";

// Exercises are interactive practice, not flip-cards.
function ExerciseBody({ c }: { c: RendererCtx<Exercise> }) {
    const t = useTranslations("elements");
    return (
        <>
            <RunnerBoundary key={c.item.id} exerciseId={c.item.id} onSkip={() => c.onReplace(null)} message={t("exerciseBroken")} skipLabel={t("skipBroken")}>
                <ExerciseRunner exercise={c.item} gaveUp={c.gaveUp} onFinished={c.onExerciseFinished} />
            </RunnerBoundary>
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
