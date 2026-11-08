// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav, usePathname: () => "/ex", useSearchParams: () => new URLSearchParams("status=ready") }));

import ExerciseFilter from "./exerciseFilter";

describe("exercise grouping choice", () => {
    it("lives in the URL next to the other filters, and the default (exam section) clears it", async () => {
        render(<ExerciseFilter types={["essay"]} />);
        const select = screen.getByLabelText("Group by");
        expect(select).toHaveValue("category");
        await userEvent.selectOptions(select, "source");
        expect(nav.replace).toHaveBeenLastCalledWith("/ex?status=ready&group=source");
    });
});
