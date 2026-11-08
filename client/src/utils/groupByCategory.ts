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

export type GroupBy = "category" | "source" | "tag" | "status" | "type";
export const GROUP_BYS: GroupBy[] = ["category", "source", "tag", "status", "type"];
export interface ExerciseGroup { key: string | null; exercises: Exercise[]; label?: string }

/** Groups the list the way the user picked. Keys: the exam section slug (null = unknown type), a source or tag id (null = none; `label` is its title / name; an exercise is listed under each of its tags), "ready"/"notready", or the exercise type. Empty groups are omitted. */
export function groupExercises(exercises: Exercise[], by: GroupBy, categories: ExamCategory[]): ExerciseGroup[] {
    if (by === "category") return groupByCategory(exercises, categories).map((g) => ({ key: g.slug, exercises: g.exercises }));
    if (by === "source" || by === "tag") {
        const labels = new Map<string, string | undefined>();
        const of = (e: Exercise) => (by === "source" ? e.sources : e.tags)?.filter((x) => x.id).map((x) => { labels.set(x.id!, (x as { title?: string; name?: string }).title ?? (x as { name?: string }).name); return x.id!; }) ?? [];
        const keys = [...new Set(exercises.flatMap(of))].sort((a, b) => (labels.get(a) ?? a).localeCompare(labels.get(b) ?? b));
        const groups: ExerciseGroup[] = keys.map((key) => ({ key, label: labels.get(key), exercises: exercises.filter((e) => of(e).includes(key)) }));
        const none = exercises.filter((e) => of(e).length === 0);
        return none.length ? [...groups, { key: null, exercises: none }] : groups;
    }
    const keyOf = (e: Exercise) => by === "status" ? (e.needs?.length ? "notready" : "ready") : (e.exercise_type || "unknown");
    const order = by === "status" ? ["ready", "notready"] : [...new Set(exercises.map(keyOf))].sort();
    return order.map((key) => ({ key, exercises: exercises.filter((e) => keyOf(e) === key) })).filter((g) => g.exercises.length > 0);
}
