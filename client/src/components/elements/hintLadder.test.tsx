// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HintLadder from "./hintLadder";

const voc = (side: "front" | "back") => ({ id: "voc_1", side, lesson_title: "Unit 3", example_sentences: [], word: { word: "旅游", translation: "to travel", phonetic: "lǚyóu", word_type: "verb" } }) as never;
const call = { id: "call_1", lesson_title: "Unit 3", character: { character: "游", meaning: "swim", phonetic: "yóu", strokes: 12, radical: "氵", key_radical: { id: "char_9", character: "氵" } } } as never;
const lines = () => screen.queryAllByRole("listitem").map((li) => li.textContent);
const ladder = (card: never, shown: { detail: boolean; example: boolean }) => render(<HintLadder card={card} level={9} onHint={() => {}} shown={shown} />);

describe("hints never repeat what the card already shows", () => {
    it("never gives the lesson: the header has it", () => {
        ladder(voc("front"), { detail: false, example: false });
        expect(lines().join(" ")).not.toMatch(/Unit 3|lesson/);
    });
    it("a vocabulary front that already shows its details skips the word type; a back keeps it", () => {
        const { unmount } = ladder(voc("front"), { detail: true, example: false });
        expect(lines().join(" ")).not.toMatch(/It is a verb/);
        unmount();
        ladder(voc("back"), { detail: true, example: false });
        expect(lines().join(" ")).toMatch(/It is a verb/);
    });
    it("a calligraphy card whose details are shown skips the reading, strokes and radical", () => {
        ladder(call, { detail: true, example: false });
        expect(lines().join(" ")).not.toMatch(/yóu|12|氵/);
    });
    it("a calligraphy card with hidden details gives strokes and the reading, but not a radical that its key-radical tile shows", () => {
        ladder(call, { detail: false, example: false });
        const text = lines().join(" ");
        expect(text).toMatch(/yóu/);
        expect(text).toMatch(/12/);
        expect(text).not.toMatch(/氵/);
    });

    it("has no filler step: a card with nothing new to say has no Hint button, and a hint never says to take your time", () => {
        const bare = { id: "voc_2", side: "front", example_sentences: [], word: { word: "好", translation: "" } } as never;
        const { unmount } = ladder(bare, { detail: false, example: false });
        expect(screen.queryByRole("button", { name: /Hint/ })).toBeNull();
        unmount();
        ladder(voc("front"), { detail: false, example: false });
        expect(screen.getAllByRole("listitem").map((li) => li.textContent).join(" ")).not.toMatch(/Take your time/);
    });
});
