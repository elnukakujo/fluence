// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ deleteElement: vi.fn().mockResolvedValue(undefined), push: vi.fn() }));
vi.mock("@/api", () => ({ deleteElement: m.deleteElement }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push }) }));

import DeleteButton from "./deleteButton";

beforeEach(() => { vi.clearAllMocks(); window.history.pushState({}, "", "/languages/lang_1/lesson/lesson_1/voc/voc_1"); });

describe("DeleteButton", () => {
    it("asks before deleting, in an accessible dialog", async () => {
        render(<DeleteButton element_id="voc_1" />);
        expect(screen.queryByRole("dialog")).toBeNull();
        await userEvent.click(screen.getByRole("button", { name: "Delete Element" }));
        expect(screen.getByRole("dialog")).toHaveTextContent("Are you sure you want to delete this element?");
        expect(m.deleteElement).not.toHaveBeenCalled();
    });

    it("cancel closes it without deleting", async () => {
        render(<DeleteButton element_id="voc_1" />);
        await userEvent.click(screen.getByRole("button", { name: "Delete Element" }));
        await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(m.deleteElement).not.toHaveBeenCalled();
    });

    it("confirm deletes the element and goes back up", async () => {
        render(<DeleteButton element_id="voc_1" />);
        await userEvent.click(screen.getByRole("button", { name: "Delete Element" }));
        await userEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));
        await waitFor(() => expect(m.deleteElement).toHaveBeenCalledWith("voc_1"));
        await waitFor(() => expect(m.push).toHaveBeenCalledWith("/languages/lang_1/lesson/lesson_1"));
    });
});
