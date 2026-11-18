// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ReviewCard } from "@/api/review";

const api = vi.hoisted(() => ({ updateScoreById: vi.fn().mockResolvedValue({}) }));
vi.mock("@/api/process", () => api);
vi.mock("next/navigation", () => ({ useParams: () => ({}), useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));

import ReviewSession from "./ReviewSession";

const gram = { id: "g1", kind: "grammar", title: "Te-form", explanation: "e", example_sentences: [], created_at: "2026-01-01T00:00:00" } as unknown as ReviewCard;

describe("review: grammar", () => {
    it("flipping the point counts as a full grade; no self-grade buttons, only Next / Edit", async () => {
        render(<ReviewSession items={[gram, { ...gram, id: "g2" }]} />);
        await userEvent.click(screen.getByRole("button", { name: /Te-form/ }));
        expect(api.updateScoreById).toHaveBeenCalledWith("g1", expect.objectContaining({ similarity: 1, evidence: "self_grade" }));
        expect(screen.queryByRole("button", { name: /again/i })).toBeNull();
        expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    });
});
