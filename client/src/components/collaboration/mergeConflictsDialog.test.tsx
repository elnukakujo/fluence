// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pick } from "@/test/selectMenu";
import MergeConflictsDialog from "./mergeConflictsDialog";

const conflicts = [
    { id: "word_X1", kind: "word" as const, key: "水", diff: ["translation"], existing: { translation: "water" }, incoming: { translation: "aqua" } },
    { id: "word_X2", kind: "word" as const, key: "火", diff: ["translation"], existing: { translation: "fire" }, incoming: { translation: "flame" } },
];

describe("MergeConflictsDialog", () => {
    afterEach(cleanup);

    it("needs one decision per item before it can merge, and returns them keyed by element id", async () => {
        const onConfirm = vi.fn();
        render(<MergeConflictsDialog conflicts={conflicts} onConfirm={onConfirm} onCancel={() => {}} />);
        const merge = screen.getByRole("button", { name: "Merge" });
        expect(merge).toBeDisabled();
        await pick(screen.getByRole("combobox", { name: /水/ }), "Take theirs");
        expect(merge).toBeDisabled();                                   // one of two is not enough
        await pick(screen.getByRole("combobox", { name: /火/ }), "Fill my gaps");
        expect(merge).toBeEnabled();
        await userEvent.click(merge);
        expect(onConfirm).toHaveBeenCalledWith({ word_X1: "overwrite", word_X2: "merge" });
    });
});
