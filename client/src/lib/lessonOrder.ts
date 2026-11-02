import type Lesson from "@/interface/containers/Lesson";

/** A copy of `items` with the element at `from` moved to `to`; the same order when `to` is out of range. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || to < 0 || to >= items.length || from < 0 || from >= items.length) return [...items];
  const next = [...items];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

/** Number of vocabulary, grammar, calligraphy and exercise entries the API lists for a lesson. */
export function itemCount(lesson: Lesson): number {
  const l = lesson as unknown as Record<string, unknown>;
  return ["vocabulary", "grammar", "calligraphy", "exercise_ids"].reduce((n, k) => n + (Array.isArray(l[k]) ? (l[k] as unknown[]).length : 0), 0);
}
