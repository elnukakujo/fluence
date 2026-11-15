import { describe, expect, it } from "vitest";
import typeMeta from "@/shared/exercise-types.json";
import { EXERCISE_TYPES, exerciseTypeInfo } from "./exerciseTypes";

describe("exercise-type registry", () => {
    it("matches the shared JSON order and names", () => {
        expect(EXERCISE_TYPES.map((t) => t.name)).toEqual(typeMeta.map((t) => t.name));
        expect(typeMeta).toHaveLength(13);
    });

    it("every entry has a Runner, i18nKey and category from the JSON", () => {
        for (const t of EXERCISE_TYPES) {
            const meta = typeMeta.find((m) => m.name === t.name)!;
            expect(t.Runner).toBeDefined();
            expect(t.i18nKey).toBe(meta.i18nKey);
            expect(t.category).toBe(meta.category);
        }
    });

    it("unknown type returns undefined", () => {
        expect(exerciseTypeInfo("nope")).toBeUndefined();
        expect(exerciseTypeInfo(undefined)).toBeUndefined();
    });
});
