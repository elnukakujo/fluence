import { describe, expect, it } from "vitest";
import { isListenFirst } from "./listenFirst";

const card = (id: string, extra: Record<string, unknown> = {}) => ({ id, card_id: `${id}#front`, side: "front" as const, word: { audio_files: ["/media/a.mp3"] }, ...extra });
const today = new Date(2026, 10, 7);

describe("isListenFirst", () => {
    it("needs a vocabulary front card, in the practising tier, with a stored clip", () => {
        const yes = Array.from({ length: 60 }, (_, i) => card(`voc_${i}`)).find((c) => isListenFirst(c, "practising", today))!;
        expect(yes).toBeTruthy();
        expect(isListenFirst({ ...yes, word: { audio_files: [] } }, "practising", today)).toBe(false);
        expect(isListenFirst({ ...yes, word: {} }, "practising", today)).toBe(false);
        expect(isListenFirst({ ...yes, side: "back" }, "practising", today)).toBe(false);
        expect(isListenFirst(yes, "learning", today)).toBe(false);
        expect(isListenFirst(yes, "maintaining", today)).toBe(false);
    });

    it("is stable for a card within a day", () => {
        for (let i = 0; i < 30; i++) {
            const c = card(`voc_${i}`);
            expect(isListenFirst(c, "practising", today)).toBe(isListenFirst(c, "practising", new Date(2026, 10, 7, 23, 59)));
        }
    });

    it("picks about one card in three, and a different third on another day", () => {
        const cards = Array.from({ length: 300 }, (_, i) => card(`voc_${i}`));
        const share = (d: Date) => cards.filter((c) => isListenFirst(c, "practising", d)).length / cards.length;
        expect(share(today)).toBeGreaterThan(0.25);
        expect(share(today)).toBeLessThan(0.42);
        const other = new Date(2026, 10, 8);
        expect(cards.some((c) => isListenFirst(c, "practising", today) !== isListenFirst(c, "practising", other))).toBe(true);
    });
});
