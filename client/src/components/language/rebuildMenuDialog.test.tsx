// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import RebuildMenuDialog from "./rebuildMenuDialog";

const setup = (open = true) => {
    const onConfirm = vi.fn(), onCancel = vi.fn();
    render(<RebuildMenuDialog open={open} mastered={3} redraw={7} onConfirm={onConfirm} onCancel={onCancel} />);
    return { onConfirm, onCancel };
};

describe("rebuild menu dialog", () => {
    it("renders nothing when closed", () => {
        setup(false);
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("shows the counts, focuses Cancel, and Esc / Cancel / Rebuild call back", async () => {
        const { onConfirm, onCancel } = setup();
        expect(screen.getByRole("dialog")).toHaveTextContent("3");
        expect(screen.getByRole("dialog")).toHaveTextContent("7");
        const [cancel, rebuild] = screen.getAllByRole("button");
        expect(cancel).toHaveFocus();
        await userEvent.keyboard("{Tab}");
        expect(rebuild).toHaveFocus();
        await userEvent.keyboard("{Tab}");
        expect(cancel).toHaveFocus();
        await userEvent.keyboard("{Escape}");
        expect(onCancel).toHaveBeenCalledTimes(1);
        await userEvent.click(rebuild);
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });
});
