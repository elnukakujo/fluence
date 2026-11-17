import type { ScopeParams } from "@/api/review";

type Q = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Reads an entry point's scope from the URL; an unknown or incomplete scope falls back to the daily queue. */
export function scopeFromQuery(q: Q): ScopeParams {
    const scope = first(q.scope);
    if (scope === "lesson" && first(q.lesson_id)) return { scope, lesson_id: first(q.lesson_id) };
    if (scope === "tag" && first(q.tag_id)) return { scope, tag_id: first(q.tag_id) };
    if (scope === "source" && first(q.source_id)) return { scope, source_id: first(q.source_id) };
    if (scope === "type" && first(q.type)) return { scope, type: first(q.type), radicals: first(q.radicals) === "1" };
    if (scope === "free" && first(q.ids)) return { scope, ids: first(q.ids).split(",").filter(Boolean) };
    return { scope: "daily" };
}
