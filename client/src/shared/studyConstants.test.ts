import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { STUDY } from "./studyConstants";
import { TIER_LEARNING_DIFFICULTY, TIER_LEARNING_SCORE, TIER_MAINTAINING_SCORE } from "@/utils/cardTier";
import { FAST_MS, HINT_CAPS, SLOW_MS } from "@/utils/cardHints";
import { DRAW_EVERY } from "@/utils/drawFirst";
import { LISTEN_EVERY } from "@/utils/listenFirst";
import { TYPED_FLOOR, TYPED_FULL } from "@/utils/typedAnswer";

describe("study constants are the one source", () => {
    it("client utils read the shared values", () => {
        expect(TIER_LEARNING_SCORE).toBe(STUDY.tier.learningScore);
        expect(TIER_LEARNING_DIFFICULTY).toBe(STUDY.tier.learningDifficulty);
        expect(TIER_MAINTAINING_SCORE).toBe(STUDY.tier.maintainingScore);
        expect(HINT_CAPS).toEqual(STUDY.hints.caps);
        expect(FAST_MS).toBe(STUDY.hints.fastMs);
        expect(SLOW_MS).toBe(STUDY.hints.slowMs);
        expect(TYPED_FULL).toBe(STUDY.typed.full);
        expect(TYPED_FLOOR).toBe(STUDY.typed.floor);
        expect(DRAW_EVERY).toBe(STUDY.cadence.drawEvery);
        expect(LISTEN_EVERY).toBe(STUDY.cadence.listenEvery);
    });

    it.each(["study-constants.json", "exercise-types.json"])("the synced %s is byte-identical to the repo-root file", (name) => {
        const synced = readFileSync(join(__dirname, name), "utf8");
        const root = readFileSync(join(__dirname, "../../../shared", name), "utf8");
        expect(synced).toBe(root);
    });
});
