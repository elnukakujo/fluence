// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearResume, loadResume, saveResume } from "./resume";

const state = { ids: ["a", "b", "c"], done: ["a"], sessionId: "s1" };

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 23, 10, 0)); });
afterEach(() => vi.useRealTimers());

describe("resume", () => {
    it("round-trips what was saved", () => {
        saveResume("/languages/l1/review", state);
        expect(loadResume("/languages/l1/review")).toMatchObject(state);
    });
    it("expires at local midnight, and only that key", () => {
        saveResume("k1", state); saveResume("k2", state);
        vi.setSystemTime(new Date(2026, 10, 24, 0, 5));
        expect(loadResume("k1")).toBeNull();
        saveResume("k2", { ...state, sessionId: "s2" });                    // saved again today: kept
        expect(loadResume("k2")?.sessionId).toBe("s2");
    });
    it("another key is untouched by clearing one", () => {
        saveResume("k1", state); saveResume("k2", state);
        clearResume("k1");
        expect(loadResume("k1")).toBeNull();
        expect(loadResume("k2")).not.toBeNull();
    });
    it("ignores a corrupt entry", () => {
        localStorage.setItem("review-resume:k1", "{nope");
        expect(loadResume("k1")).toBeNull();
    });
});
