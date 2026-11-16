import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock("../apiFetch", () => ({ apiFetch }));

import { updateScoreById } from "./index";

const answer = { similarity: 0.8, skill: "recall", evidence: "typed", durationMs: 1200 } as const;
beforeEach(() => apiFetch.mockClear());

describe("updateScoreById", () => {
    it("posts the skill and evidence to the kind's route", async () => {
        await updateScoreById("voc_1", { ...answer, side: "back", hintUsed: true });
        expect(apiFetch).toHaveBeenCalledWith("/api/vocabulary/score", expect.objectContaining({
            method: "POST",
            body: { vocabulary_id: "voc_1", similarity: 0.8, skill: "recall", evidence_type: "typed", duration_ms: 1200, hint_used: true, side: "back" },
        }));
    });

    it("sends the attempt only for exercises", async () => {
        await updateScoreById("ex_1", { ...answer, attempt: 2 });
        expect(apiFetch.mock.calls[0][1].body).toMatchObject({ exercise_id: "ex_1", attempt_number: 2, hint_used: false });
    });

    it("refuses an element without a score route", async () => {
        await expect(updateScoreById("word_1", answer)).rejects.toThrow("Unsupported element ID");
    });
});
