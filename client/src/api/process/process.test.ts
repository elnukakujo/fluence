import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock("../apiFetch", () => ({ apiFetch }));

import { scoreExercise, updateScoreById } from "./index";

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

    it("refuses an element without a score route", async () => {
        await expect(updateScoreById("word_1", answer)).rejects.toThrow("Unsupported element ID");
    });
});

describe("scoreExercise", () => {
    it("posts the per-element results of the attempt", async () => {
        const results = [{ element_id: "voc_1", quality: 1, skill: "recall", evidence_type: "typed" }] as const;
        await scoreExercise("ex_1", { results: [...results], attempt: 2, final: true, durationMs: 900, hintUsed: false });
        expect(apiFetch).toHaveBeenCalledWith("/api/exercise/score", expect.objectContaining({
            method: "POST",
            body: { exercise_id: "ex_1", results, attempt: 2, final: true, duration_ms: 900, hint_used: false },
        }));
    });

    it("no longer scores an exercise through updateScoreById", async () => {
        await expect(updateScoreById("ex_1", answer)).rejects.toThrow("Unsupported element ID");
    });
});
