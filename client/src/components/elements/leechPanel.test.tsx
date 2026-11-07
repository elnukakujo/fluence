// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ saveCardNote: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/api/review", () => api);

import LeechPanel from "./leechPanel";

const leech = { lapses: 5, parts: [{ character: "日", phonetic: "rì", meaning: "sun" }, { character: "本", phonetic: "běn", meaning: "book" }], confusable: null };
beforeEach(() => vi.clearAllMocks());

describe("LeechPanel", () => {
    it("says the card keeps slipping and lists what the word is made of", () => {
        render(<LeechPanel id="voc_1" leech={leech} note={null} />);
        expect(screen.getByRole("status")).toHaveTextContent("This one keeps slipping (5 misses)");
        expect(screen.getByText("日")).toBeInTheDocument();
        expect(screen.getByText(/sun/)).toBeInTheDocument();
        expect(screen.getByText(/book/)).toBeInTheDocument();
    });

    it("saves the note when the field is left, only if it changed", async () => {
        render(<LeechPanel id="voc_1" leech={{ ...leech, parts: [] }} note="old" />);
        const field = screen.getByLabelText("Your memory trick");
        expect(field).toHaveValue("old");
        await userEvent.click(field);
        await userEvent.tab();
        expect(api.saveCardNote).not.toHaveBeenCalled();
        await userEvent.type(field, " + more");
        await userEvent.tab();
        expect(api.saveCardNote).toHaveBeenCalledWith("voc_1", "old + more");
    });
});
