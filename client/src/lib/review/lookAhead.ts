import { PUBLIC_BASE_URL } from "@/api";
import { loadStrokeData } from "@/lib/calligraphy/strokeData";
import type { ReviewCard } from "@/api/review";

const AHEAD = 2;
const audioDone = new Set<string>();

/** While the learner works on card `index`, get what the next two cards will need: stroke data of a calligraphy card (cached for the session by
 *  `loadStrokeData`) and the first audio file of any card, so neither shows "Loading…" when the card opens (RC-27). */
export function preloadAhead(cards: ReviewCard[], index: number): void {
    for (const card of cards.slice(index + 1, index + 1 + AHEAD)) {
        const character = (card as { character?: { character?: string } }).character?.character;
        if (character) void loadStrokeData(character);
        const file = (card as { audio_files?: string[] }).audio_files?.[0];
        if (file && !audioDone.has(file) && typeof Audio !== "undefined") {
            audioDone.add(file);
            const audio = new Audio(PUBLIC_BASE_URL + file);
            audio.preload = "auto";
        }
    }
}
