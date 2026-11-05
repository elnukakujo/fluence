import type Exercise from "@/interface/features/Exercise";

/** Exercises to practise: ready (nothing missing) and not banned, shuffled, boosted ones first. */
export function selectPracticeExercises(exercises: Exercise[], rng: () => number = Math.random): Exercise[] {
    const shuffled = exercises
        .filter((e) => !e.needs?.length && !e.banned)
        .map((e) => ({ e, k: rng() }))
        .sort((a, b) => a.k - b.k)
        .map((x) => x.e);
    return [...shuffled.filter((e) => e.boosted), ...shuffled.filter((e) => !e.boosted)];
}
