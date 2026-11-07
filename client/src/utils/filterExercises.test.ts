import { describe, expect, it } from "vitest";
import type Exercise from "@/interface/features/Exercise";
import { categoriesWithDerived, filterExercises } from "./filterExercises";
import { getExamCategories } from "./language_iso639";

const ex = (id: string, exercise_type: string, extra: Partial<Exercise> = {}) => ({ id, exercise_type, needs: [], ...extra }) as Exercise;
const none = { types: [], status: "", category: "", origin: "" };
const ids = (xs: Exercise[]) => xs.map((e) => e.id);
const zho = getExamCategories("zho");
const list = [ex("a", "essay"), ex("b", "speaking", { generation_batch_id: "b1" }), ex("c", "dictation", { needs: ["audio"] })];

describe("filterExercises", () => {
  it("no filter keeps everything", () => expect(ids(filterExercises(list, none, zho))).toEqual(["a", "b", "c"]));
  it("origin ai keeps only generated exercises", () => expect(ids(filterExercises(list, { ...none, origin: "ai" }, zho))).toEqual(["b"]));
  it("filters by type, status and derived category", () => {
    expect(ids(filterExercises(list, { ...none, types: ["essay", "speaking"] }, zho))).toEqual(["a", "b"]);
    expect(ids(filterExercises(list, { ...none, status: "notready" }, zho))).toEqual(["c"]);
    expect(ids(filterExercises(list, { ...none, status: "ready" }, zho))).toEqual(["a", "b"]);
    expect(ids(filterExercises(list, { ...none, category: "speaking" }, zho))).toEqual(["b"]);
  });
});

describe("categoriesWithDerived", () => {
  it("adds a derived category the exam lacks, once, after the exam's own", () => {
    const out = categoriesWithDerived([ex("b", "speaking"), ex("d", "conversation")], zho).map((c) => c.slug);
    expect(out).toEqual([...zho.map((c) => c.slug), "speaking"]);
  });
  it("adds nothing when the exam already has them", () => expect(categoriesWithDerived([ex("a", "essay")], zho)).toEqual(zho));
});
