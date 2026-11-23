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

const open = async (props: Parameters<typeof LeechPanel>[0]) => { render(<LeechPanel {...props} />); await userEvent.click(screen.getByRole("button", { name: /Keeps slipping/ })); };

describe("LeechPanel", () => {
    it("says the card keeps slipping and lists what the word is made of", async () => {
        await open({ id: "voc_1", leech: leech, note: null });
        expect(screen.getByRole("dialog", { name: "This one keeps slipping (5 misses)" })).toBeInTheDocument();
        expect(screen.getByText("日")).toBeInTheDocument();
        expect(screen.getByText(/sun/)).toBeInTheDocument();
        expect(screen.getByText(/book/)).toBeInTheDocument();
    });

    it("shows how close the card is to leaving (n/3 right in a row) and what it is confused with", async () => {
        await open({ id: "voc_1", leech: { ...leech, correct_in_row: 2, confusable: { word: "日本人", translation: "Japanese person" } }, note: null });
        expect(screen.getByTestId("leech-leaving")).toHaveTextContent("2/3 correct in a row");
        expect(screen.getByText(/日本人.*Japanese person/)).toBeInTheDocument();
    });

    it("starts at 0/3 when the server sent no streak", async () => {
        await open({ id: "voc_1", leech: leech, note: null });
        expect(screen.getByTestId("leech-leaving")).toHaveTextContent("0/3");
    });

    it("saves the note when the field is left, only if it changed", async () => {
        await open({ id: "voc_1", leech: { ...leech, parts: [] }, note: "old" });
        const field = screen.getByLabelText("Your memory trick");
        expect(field).toHaveValue("old");
        await userEvent.click(field);
        await userEvent.tab();
        expect(api.saveCardNote).not.toHaveBeenCalled();
        await userEvent.type(field, " + more");
        await userEvent.tab();
        expect(api.saveCardNote).toHaveBeenCalledWith("voc_1", "old + more");
    });

    it("is a chip until opened: no panel in the page, and the dialog is a portal on the body", async () => {
        const { container } = render(<LeechPanel id="voc_1" leech={leech} note={null} />);
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(container.textContent).toBe("Keeps slipping · 5");
        await userEvent.click(screen.getByRole("button", { name: /Keeps slipping/ }));
        expect(container.querySelector('[role="dialog"]')).toBeNull();                 // not in the card's flow
        expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    });

    it("saves a typed note when the dialog is closed", async () => {
        await open({ id: "voc_1", leech: { ...leech, parts: [] }, note: null });
        await userEvent.type(screen.getByLabelText("Your memory trick"), "story");
        await userEvent.keyboard("{Escape}");
        expect(api.saveCardNote).toHaveBeenCalledWith("voc_1", "story");
        expect(screen.queryByRole("dialog")).toBeNull();
    });
});
