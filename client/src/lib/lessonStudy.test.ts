import { describe, expect, it } from "vitest";
import type Vocabulary from "@/interface/features/Vocabulary";
import { frontsThenBacks } from "./lessonStudy";

const voc = (id: string) => ({ id, word: { word: id, translation: id } }) as unknown as Vocabulary;
const identity = <T,>(xs: T[]) => [...xs];

describe("frontsThenBacks", () => {
    it("asks every word on both sides: all fronts, then all backs", () => {
        const items = frontsThenBacks([voc("a"), voc("b")], identity);
        expect(items.map((i) => `${i.id}:${i.side}`)).toEqual(["a:front", "b:front", "a:back", "b:back"]);
    });

    it("gives each side its own card_id so the two sides of a word are distinct cards in the shell", () => {
        const ids = frontsThenBacks([voc("a"), voc("b")], identity).map((i) => (i as unknown as { card_id: string }).card_id);
        expect(ids).toEqual(["a#front", "b#front", "a#back", "b#back"]);
        expect(new Set(ids).size).toBe(4);
    });

    it("shuffles fronts and backs independently with the given shuffle", () => {
        const reverse = <T,>(xs: T[]) => [...xs].reverse();
        expect(frontsThenBacks([voc("a"), voc("b")], reverse).map((i) => `${i.id}:${i.side}`)).toEqual(["b:front", "a:front", "b:back", "a:back"]);
    });
});
