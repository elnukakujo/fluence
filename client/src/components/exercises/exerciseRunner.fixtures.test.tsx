// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type Exercise from "@/interface/features/Exercise";
import fixtures from "@/test/exerciseContent.json";

vi.mock("@/api/process", () => ({ updateScoreById: vi.fn().mockResolvedValue({}), evaluateText: vi.fn() }));
vi.mock("@/api/exercise", () => ({ generateLineAudio: vi.fn() }));

import ExerciseRunner from "./exerciseRunner";

// the backend `Exercise.needs` accepts these (tests/test_exercise_needs.py): every runner must render them without throwing
describe("runners render every content the backend calls ready", () => {
    it.each(fixtures.good)("%s", (type, content) => {
        const exercise = { id: "ex", exercise_type: type, content, question: "q", answer: "a", audio_files: [], related_vocabulary: [], related_grammar: [], related_characters: [], related_calligraphy: [] } as unknown as Exercise;
        expect(() => render(<ExerciseRunner exercise={exercise} />)).not.toThrow();
    });
});
