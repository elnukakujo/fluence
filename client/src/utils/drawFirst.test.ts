import { describe, expect, it } from "vitest";
import { isDrawFirst } from "./drawFirst";

const today = new Date(2026, 10, 9);
const cards = Array.from({ length: 300 }, (_, i) => ({ id: `call_${i}` }));

describe("isDrawFirst", () => {
    it("is never true for a maintaining card", () => {
        expect(cards.some((c) => isDrawFirst(c, "maintaining", today))).toBe(false);
    });
    it("is stable for a card within a day", () => {
        for (const c of cards.slice(0, 30)) expect(isDrawFirst(c, "learning", today)).toBe(isDrawFirst(c, "learning", new Date(2026, 10, 9, 23, 59)));
    });
    it("picks about one card in three, a different third another day", () => {
        const share = (d: Date) => cards.filter((c) => isDrawFirst(c, "practising", d)).length / cards.length;
        expect(share(today)).toBeGreaterThan(0.25);
        expect(share(today)).toBeLessThan(0.42);
        const other = new Date(2026, 10, 10);
        expect(cards.filter((c) => isDrawFirst(c, "practising", today) !== isDrawFirst(c, "practising", other)).length).toBeGreaterThan(0);
    });
});
