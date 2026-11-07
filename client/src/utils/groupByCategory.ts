import type Exercise from "@/interface/features/Exercise";
import { categoryOf, type ExamCategory } from "@/utils/language_iso639";

export interface CategoryGroup { slug: string | null; exercises: Exercise[] }

/** Groups by the category derived from the exercise type: the exam's order, then slugs the exam lacks (by slug), then unknown types (null) last. Empty groups are omitted. */
export function groupByCategory(exercises: Exercise[], categories: ExamCategory[]): CategoryGroup[] {
    const known = categories.map((c) => c.slug);
    const cat = (e: Exercise) => categoryOf(e.exercise_type, categories);
    const stale = [...new Set(exercises.map(cat).filter((c): c is string => !!c && !known.includes(c)))].sort();
    return [...known, ...stale, null]
        .map((slug) => ({ slug, exercises: exercises.filter((e) => cat(e) === slug) }))
        .filter((g) => g.exercises.length > 0);
}

const LABELLED = ["listening", "reading", "writing", "speaking", "language_knowledge"];
/** Display label of a slug: translated when known, the raw slug otherwise (a stale or custom value). */
export function categoryLabel(t: (key: string) => string, slug: string): string {
    return LABELLED.includes(slug) ? t(`cat_${slug}`) : slug;
}

export type GroupBy = "category" | "origin" | "status" | "type";
export const GROUP_BYS: GroupBy[] = ["category", "origin", "status", "type"];
export interface ExerciseGroup { key: string | null; exercises: Exercise[] }

/** Groups the list the way the user picked. Keys: the exam section slug (null = unknown type), "ai"/"manual", "ready"/"notready", or the exercise type. Empty groups are omitted. */
export function groupExercises(exercises: Exercise[], by: GroupBy, categories: ExamCategory[]): ExerciseGroup[] {
    if (by === "category") return groupByCategory(exercises, categories).map((g) => ({ key: g.slug, exercises: g.exercises }));
    const keyOf = (e: Exercise) => by === "origin" ? (e.generation_batch_id ? "ai" : "manual") : by === "status" ? (e.needs?.length ? "notready" : "ready") : (e.exercise_type || "unknown");
    const order = by === "origin" ? ["ai", "manual"] : by === "status" ? ["ready", "notready"] : [...new Set(exercises.map(keyOf))].sort();
    return order.map((key) => ({ key, exercises: exercises.filter((e) => keyOf(e) === key) })).filter((g) => g.exercises.length > 0);
}
