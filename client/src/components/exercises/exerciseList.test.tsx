// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useParams: () => ({ language_id: "l1", lesson_id: "lesson_1" }), useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/" }));
vi.mock("./generateDialog", () => ({ default: () => <button>Generate exercises</button> }));
vi.mock("@/components/layout/navButton", () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock("@/components/elements/itemSelection", () => ({ useItemSelection: () => ({ isActive: () => false }), SelectToggle: () => null }));

import ExerciseList from "./exerciseList";

describe("exercise card on the lesson page", () => {
    it("offers generating even when the lesson has no exercise yet (owner only)", () => {
        const { rerender } = render(<ExerciseList exProps={[]} isOwner />);
        expect(screen.getByRole("button", { name: "Generate exercises" })).toBeInTheDocument();
        rerender(<ExerciseList exProps={[]} />);
        expect(screen.queryByRole("button", { name: "Generate exercises" })).toBeNull();
    });
});
