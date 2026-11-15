import { describe, expect, it } from "vitest";
import type Vocabulary from "@/interface/features/Vocabulary";
import type { VocSidePattern } from "@/interface/systemData/UserPreferences";
import { orderSingleSided, orderVocabulary } from "./lessonStudy";

const voc = (id: string) => ({ id, word: { word: id, translation: id } }) as unknown as Vocabulary;
const words = [voc("a"), voc("b"), voc("c")];
const keys = (items: Vocabulary[]) => items.map((i) => `${i.id}:${i.side}`);
const reversed = () => 0;   // rng that makes shuffle deterministic

describe("orderVocabulary", () => {
    it("blocks: all fronts, then all backs, in lesson order", () => {
        expect(keys(orderVocabulary(words.slice(0, 2), { mode: "split" }))).toEqual(["a:front", "b:front", "a:back", "b:back"]);
    });

    it("alternate: front/back in turns by the ratio, leftovers at the end", () => {
        const p: VocSidePattern = { mode: "cycle", cycle: ["F", "F", "B"] };
        expect(keys(orderVocabulary(words, p))).toEqual(["a:front", "b:front", "a:back", "c:front", "b:back", "c:back"]);
    });

    it("random is the default (no setting): every side exactly once, shuffled", () => {
        const out = orderVocabulary(words, null, reversed);
        expect(keys(out).sort()).toEqual(["a:back", "a:front", "b:back", "b:front", "c:back", "c:front"]);
        expect(keys(out)).not.toEqual(keys(orderVocabulary(words, { mode: "split" })));
    });

    it("gives each side its own card_id so the two sides of a word stay distinct cards", () => {
        const ids = orderVocabulary(words, { mode: "split" }).map((i) => (i as unknown as { card_id: string }).card_id);
        expect(new Set(ids).size).toBe(6);
    });
});

describe("orderSingleSided", () => {
    it("shuffles under random (default), keeps lesson order for the other orders", () => {
        expect(orderSingleSided([1, 2, 3], { mode: "split" })).toEqual([1, 2, 3]);
        expect(orderSingleSided([1, 2, 3], null, reversed).sort()).toEqual([1, 2, 3]);
        expect(orderSingleSided([1, 2, 3], null, reversed)).not.toEqual([1, 2, 3]);
    });
});
