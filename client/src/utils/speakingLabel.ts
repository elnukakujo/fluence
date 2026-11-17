import { STUDY } from "@/shared/studyConstants";

export type SpeakingLabel = "excellent" | "good" | "keepGoing";

/** How a spoken answer reads to the learner: speech-to-text is approximate, so the bar is the text similarity minus a fixed
 *  offset (DM-63) and the label is read off the bar. The cut-offs are TODO(owner) stand-ins (`speaking` in study-constants.json). */
export function speakingLabel(similarity: number): { label: SpeakingLabel; barValue: number } {
    const barValue = Math.min(1, Math.max(0, similarity - STUDY.speaking.offset));
    const label = barValue >= STUDY.speaking.excellentFrom ? "excellent" : barValue >= STUDY.speaking.goodFrom ? "good" : "keepGoing";
    return { label, barValue };
}
