import type Exercise from "@/interface/features/Exercise";
import { categoryOf, type ExamCategory } from "./language_iso639";

export interface ExerciseFilters { types: string[]; status: string; category: string; origin: string }

/** The exercises matching every active filter (empty = off). `origin: "ai"` keeps the AI-generated ones. */
export function filterExercises(exercises: Exercise[], f: ExerciseFilters, categories: ExamCategory[]): Exercise[] {
    return exercises.filter((e) =>
        (!f.types.length || f.types.includes(e.exercise_type || "unknown")) &&
        (!f.status || (f.status === "ready") === !e.needs?.length) &&
        (!f.category || categoryOf(e.exercise_type, categories) === f.category) &&
        (f.origin !== "ai" || !!e.generation_batch_id));
}

/** The exam's sections plus the ones the exercises derive that the exam lacks (e.g. speaking in HSK/JLPT), so every group has a chip. */
export function categoriesWithDerived(exercises: Exercise[], categories: ExamCategory[]): ExamCategory[] {
    const known = new Set(categories.map((c) => c.slug));
    const extra = [...new Set(exercises.map((e) => categoryOf(e.exercise_type, categories)).filter((s): s is string => !!s && !known.has(s)))].sort();
    return [...categories, ...extra.map((slug) => ({ slug }) as ExamCategory)];
}
