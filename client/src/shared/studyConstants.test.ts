import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { STUDY, levelFor, isWeak, fadingDays, FADING_CAP } from "./studyConstants";
import { TIER_LEARNING_DIFFICULTY, TIER_LEARNING_SCORE, TIER_MAINTAINING_SCORE } from "@/utils/cardTier";
import { FAST_MS, HINT_CAPS, SLOW_MS } from "@/utils/cardHints";
import { DRAW_EVERY } from "@/utils/drawFirst";
import { LISTEN_EVERY } from "@/utils/listenFirst";
import { TYPED_FLOOR, TYPED_FULL } from "@/utils/typedAnswer";

describe("study constants are the one source", () => {
    it("client utils read the shared values", () => {
        expect(TIER_LEARNING_SCORE).toBe(STUDY.levels.knownFrom);
        expect(TIER_LEARNING_DIFFICULTY).toBe(STUDY.tier.learningDifficulty);
        expect(TIER_MAINTAINING_SCORE).toBe(STUDY.levels.masteredFrom);
        expect(HINT_CAPS).toEqual(STUDY.hints.caps);
        expect(FAST_MS).toBe(STUDY.hints.fastMs);
        expect(SLOW_MS).toBe(STUDY.hints.slowMs);
        expect(TYPED_FULL).toBe(STUDY.typed.full);
        expect(TYPED_FLOOR).toBe(STUDY.typed.floor);
        expect(DRAW_EVERY).toBe(STUDY.cadence.drawEvery);
        expect(LISTEN_EVERY).toBe(STUDY.cadence.listenEvery);
    });

    it("levelFor and isWeak follow the shared cut-offs", () => {
        expect([39.99, 40, 59.99, 60, 84.99, 85].map(levelFor)).toEqual(["learning", "learning", "learning", "known", "known", "mastered"]);
        expect(isWeak(39.99)).toBe(true);
        expect(isWeak(40)).toBe(false);
    });

    it.each(["study-constants.json", "exercise-types.json"])("the synced %s is byte-identical to the repo-root file", (name) => {
        const synced = readFileSync(join(__dirname, name), "utf8");
        const root = readFileSync(join(__dirname, "../../../shared", name), "utf8");
        expect(synced).toBe(root);
    });
});

describe("fadingDays: days until the effective score leaves its band", () => {
    it("is monotonic in stability and null for weak or unseen", () => {
        const d = [1, 4, 16, 64].map((st) => fadingDays(70, st)!);
        expect(d).toEqual([...d].sort((a, b) => a - b));
        expect(fadingDays(30, 10)).toBeNull();
        expect(fadingDays(0, 10)).toBeNull();
    });
    it("is the half-life maths: one half-life to reach the edge", () => {
        expect(fadingDays(70, 10)).toBe(Math.round(10 * Math.log2(70 / STUDY.levels.knownFrom)));   // 70 -> 60 edge
        expect(fadingDays(STUDY.levels.knownFrom, 10)).toBe(0);
    });
    it("caps the display", () => {
        expect(fadingDays(99, 500)).toBe(FADING_CAP);
    });
});
