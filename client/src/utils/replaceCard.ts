import type Exercise from "@/interface/features/Exercise";
import { needsHearing, needsSpeaking } from "./exerciseSkills";

/** The first unused spare exercise the learner can do: `lacks` is what they can't do right now (null = anything goes). */
export function pickReplacement<T extends Exercise>(spares: T[], lacks: "hearing" | "speaking" | null, used: Set<string>): T | undefined {
    return spares.find((s) => !used.has(s.id!) && !(lacks === "hearing" && needsHearing(s)) && !(lacks === "speaking" && needsSpeaking(s)));
}
