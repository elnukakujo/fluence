import type Exercise from "@/interface/features/Exercise";
import { elementKindOf } from "@/api/elementKinds";
import type { ExerciseResult } from "@/api/process";

export type Skill = "recognition" | "recall";
export type Evidence = "typed" | "spoken" | "self_grade" | "multiple_choice" | "matching";

/** The skill an answer on an element trains. A vocabulary face decides: front = recognition, back = recall; a listen card recognises, a speak card recalls.
 *  Grammar is recognition; calligraphy, characters and exercises are recall. The server rejects a skill the kind does not have. */
export function skillFor(elementId: string, side?: "front" | "back", mode?: "listen" | "speak"): Skill {
    const kind = elementKindOf(elementId)?.kind;
    if (kind === "grammar") return "recognition";
    if (kind !== "vocabulary") return "recall";
    return mode ? (mode === "speak" ? "recall" : "recognition") : side === "back" ? "recall" : "recognition";
}

/** How an exercise answer was given (the server weights it: typed and spoken count most, picking from options least). */
export function evidenceFor(type: Exercise["exercise_type"]): Evidence {
    switch (type) {
        case "quizz": case "true_false": case "select_in_the_blank": return "multiple_choice";
        case "matching": return "matching";
        case "speaking": case "conversation": return "spoken";
        case "reading": return "self_grade";      // marked done, not tested
        default: return "typed";                  // answering, essay, translate, organize, type-in-the-blank, dictation
    }
}

/** The element each blank / pair of an exercise tests (undefined = none recorded). */
function partElements(ex: Exercise): (string | undefined)[] {
    const c = ex.content as { blanks?: { element_id?: string }[]; element_ids?: (string | null)[] } | undefined;
    return c?.blanks ? c.blanks.map((b) => b.element_id) : (c?.element_ids ?? []).map((id) => id ?? undefined);
}

/** What an exercise attempt says about each element, for the server's per-element credit (DM-6, DM-57).
 *  `parts` = the quality of each blank / pair, in order: a part credits the element it tests (the server averages parts of one element).
 *  A linked element no part tests gets the exercise `quality`; with no part at all, every linked element does; with no linked element, the exercise stands for itself. */
export function exerciseResults(ex: Exercise, quality: number, parts?: number[]): ExerciseResult[] {
    const linked = [...(ex.related_vocabulary ?? []), ...(ex.related_grammar ?? []), ...(ex.related_calligraphy ?? [])];
    const evidence_type = evidenceFor(ex.exercise_type);
    const make = (element_id: string, q: number): ExerciseResult => ({ element_id, quality: q, skill: skillFor(element_id), evidence_type });
    const ids = partElements(ex);
    const tested = (parts ?? []).flatMap((q, i) => (ids[i] && linked.includes(ids[i]!) ? [make(ids[i]!, q)] : []));
    const covered = new Set(tested.map((r) => r.element_id));
    const rest = linked.filter((id) => !covered.has(id)).map((id) => make(id, quality));
    const all = [...tested, ...rest];
    return all.length ? all : [make(ex.id!, quality)];
}
