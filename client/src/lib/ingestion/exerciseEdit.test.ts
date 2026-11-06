import { describe, expect, it } from "vitest";
import { blankRows, contentIsValid, editedFields, organizeInOrder } from "./exerciseEdit";

describe("editedFields: question/answer follow the content the way the exercise form stores them", () => {
  it("type-in blanks: question is the segments joined by __, answer the blank answers, and the consigne line stays", () => {
    const old = { segments: ["He ", " tall."], blanks: [{ answer: "is" }] };
    const out = editedFields("type_in_the_blank", "Fill in\nHe __ tall.", old, { segments: ["She ", " short and ", "."], blanks: [{ answer: "is" }, { answer: "very" }] });
    expect(out).toEqual({ question: "Fill in\nShe __ short and __.", answer: "is, very", content: { segments: ["She ", " short and ", "."], blanks: [{ answer: "is" }, { answer: "very" }] } });
  });
  it("starts from nothing: content was missing, so a new hole and answer become the content", () => {
    const out = editedFields("type_in_the_blank", "Fill in\nHe ___ tall.", null, { segments: ["He ", " tall."], blanks: [{ answer: "is" }] });
    expect(out.question).toBe("Fill in\nHe __ tall.");
    expect(out.answer).toBe("is");
  });
  it("matching and quizz keep the question; their answers come from the content", () => {
    expect(editedFields("matching", "Match them", null, { pairs: [["a", "b"], ["c", "d"]] })).toMatchObject({ question: "Match them", answer: "a - b; c - d" });
    expect(editedFields("quizz", "Pick", null, { options: ["x", "y", "z"], correct: [0, 2] })).toMatchObject({ question: "Pick", answer: "x, z" });
  });
  it("organize: items are typed in the correct order; true/false: statement leads the question", () => {
    expect(editedFields("organize", "Order\nis He tall", { items: ["is", "He", "tall"], answer_order: [1, 0, 2] }, { items: ["He", "is", "tall"], answer_order: [0, 1, 2] }))
      .toMatchObject({ question: "Order\nHe is tall", answer: "He is tall" });
    expect(editedFields("true_false", "Decide\nSky is red", { statement: "Sky is red", answer: true }, { statement: "Sky is blue", answer: false }))
      .toMatchObject({ question: "Decide\nSky is blue", answer: "false" });
  });
  it("reading and dictation: answer is the joined lines and an empty question falls back to the first line", () => {
    expect(editedFields("dictation", "", null, { lines: [{ text: "Hallo", audioIndex: null }, { text: "Welt", audioIndex: null }] })).toMatchObject({ question: "Hallo", answer: "Hallo Welt" });
  });
});

describe("helpers", () => {
  it("blankRows shows missing content as one empty blank and joins options", () => {
    expect(blankRows(null)).toEqual([{ answer: "", options: "" }]);
    expect(blankRows({ segments: ["a", "b"], blanks: [{ answer: "x", options: ["x", "y"] }] })).toEqual([{ answer: "x", options: "x, y" }]);
  });
  it("organizeInOrder lists the items in their correct order", () => {
    expect(organizeInOrder({ items: ["is", "He", "tall"], answer_order: [1, 0, 2] })).toEqual(["He", "is", "tall"]);
  });
  it("contentIsValid needs a hole, a non-empty answer per hole, and 2+ options for a select", () => {
    expect(contentIsValid("type_in_the_blank", { segments: ["a ", ""], blanks: [{ answer: "x" }] })).toBe(true);
    expect(contentIsValid("type_in_the_blank", { segments: ["a"], blanks: [] })).toBe(false);
    expect(contentIsValid("type_in_the_blank", { segments: ["a ", ""], blanks: [{ answer: " " }] })).toBe(false);
    expect(contentIsValid("select_in_the_blank", { segments: ["a ", ""], blanks: [{ answer: "x", options: ["x"] }] })).toBe(false);
    expect(contentIsValid("select_in_the_blank", { segments: ["a ", ""], blanks: [{ answer: "x", options: ["x", "y"] }] })).toBe(true);
    expect(contentIsValid("matching", null)).toBe(false);
  });
});

import { blankStart, instructionOf, withInstruction } from "./exerciseEdit";
describe("instruction and missing-content start", () => {
  it("instructionOf/withInstruction edit only the consigne of a derived type", () => {
    const c = { segments: ["He ", " tall."], blanks: [{ answer: "is" }] };
    expect(instructionOf("type_in_the_blank", "Fill in\nHe __ tall.", c)).toBe("Fill in");
    expect(withInstruction("type_in_the_blank", c, "Complete")).toBe("Complete\nHe __ tall.");
    expect(instructionOf("quizz", "Pick one", null)).toBe("Pick one");
  });
  it("blankStart finds the holes in a question whose content was lost", () => {
    expect(blankStart("Fill in\nHe ___ tall and ___.", "is, very")).toEqual({
      segments: ["He ", " tall and ", "."], rows: [{ answer: "is", options: "" }, { answer: "very", options: "" }] });
    expect(blankStart("No hole here", "x").rows).toEqual([{ answer: "", options: "" }]);
  });
});
