import type Exercise from "@/interface/features/Exercise";
import { elementKindOf } from "@/api/elementKinds";
import type { Answer } from "@/api/process";

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

/** The answer an exercise runner posts: skill and evidence follow from the exercise itself. */
export function exerciseAnswer(ex: Exercise, similarity: number, durationMs: number, hintUsed: boolean, attempt: number): Answer {
    return { similarity, skill: skillFor(ex.id!), evidence: evidenceFor(ex.exercise_type), durationMs, hintUsed, attempt };
}
