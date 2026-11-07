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
