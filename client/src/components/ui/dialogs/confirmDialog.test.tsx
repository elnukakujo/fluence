// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ConfirmDialog from "./confirmDialog";

const setup = (extra: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) => {
    const onConfirm = vi.fn(), onCancel = vi.fn();
    render(<ConfirmDialog message="Delete this?" confirmLabel="Delete" onConfirm={onConfirm} onCancel={onCancel} {...extra} />);
    return { onConfirm, onCancel };
};

describe("ConfirmDialog", () => {
    it("is a modal dialog named by its title and carrying the message", () => {
        setup({ title: "Delete lesson" });
        const dialog = screen.getByRole("dialog", { name: "Delete lesson" });
        expect(dialog).toHaveAttribute("aria-modal", "true");
        expect(dialog).toHaveTextContent("Delete this?");
    });

    it("has a default title so it is never unnamed", () => {
        setup();
        expect(screen.getByRole("dialog", { name: "Please confirm" })).toBeInTheDocument();
    });

    it("confirms and cancels", async () => {
        const { onConfirm, onCancel } = setup();
        await userEvent.click(screen.getByRole("button", { name: "Delete" }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("Escape cancels", async () => {
        const { onCancel, onConfirm } = setup();
        await userEvent.keyboard("{Escape}");
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it("a destructive confirm is styled as danger, a normal one as primary", () => {
        setup({ danger: true });
        expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("btn-danger");
    });

    it("all its buttons are 44px targets and the close button is named", () => {
        setup();
        for (const b of screen.getAllByRole("button")) {
            expect(b.className).toMatch(/min-h-11/);
            expect(b.className).toMatch(/min-w-11/);
        }
        expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    });
});
