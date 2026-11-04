import { PUBLIC_BASE_URL } from "@/api";
import { speak } from "@/utils/speech";

/** Plays the line's clip when `audioIndex` points at one, else speaks `text` with the browser voice. False when neither is possible. */
export function playLine(audioFiles: string[] | undefined, audioIndex: number | null | undefined, text: string, lang?: string): boolean {
    const clip = typeof audioIndex === "number" ? audioFiles?.[audioIndex] : undefined;
    if (clip) {
        new Audio(PUBLIC_BASE_URL + clip).play().catch(console.error);
        return true;
    }
    return speak(text, lang);
}
