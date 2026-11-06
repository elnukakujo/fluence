// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ExerciseBody from "./exerciseBody";
import { initialRows, type Candidate } from "@/lib/ingestion/review";

const show = (over: Partial<Candidate>) =>
  render(<ExerciseBody row={initialRows([{ id: "x", kind: "exercise", exercise_type: "answering", question: "Q?", answer: "A!", quote: "Q", page: 0, chunk_id: "c", status: "verified", flags: [], min_conf: null, ...over }])[0]} />);

describe("ExerciseBody", () => {
  it("free text: question, support text and answer", () => {
    show({ text_support: "Some passage" });
    ["Q?", "Some passage", "A!"].forEach((x) => expect(screen.getByText(x)).toBeInTheDocument());
  });
  it("quizz marks every correct option", () => {
    show({ exercise_type: "quizz", content: { options: ["red", "blue", "green"], correct: [0, 2] } });
    expect(screen.getByText("red").parentElement).toHaveTextContent("(correct)");
    expect(screen.getByText("blue").parentElement).not.toHaveTextContent("(correct)");
    expect(screen.getByText("green").parentElement).toHaveTextContent("(correct)");
  });
  it("true/false, organize and matching show their own fields", () => {
    const a = show({ exercise_type: "true_false", content: { statement: "s", answer: false } });
    expect(screen.getByText("False")).toBeInTheDocument(); a.unmount();
    const b = show({ exercise_type: "organize", content: { items: ["is", "He", "tall"], answer_order: [1, 0, 2] } });
    expect(screen.getByText("He is tall")).toBeInTheDocument(); b.unmount();
    show({ exercise_type: "matching", content: { pairs: [["cat", "chat"]] } });
    expect(screen.getByText("cat")).toBeInTheDocument(); expect(screen.getByText("chat")).toBeInTheDocument();
  });
  it("reading shows speakers, lines and translations; a long support text starts collapsed", () => {
    show({ exercise_type: "reading", text_support: "x".repeat(300), content: { speakers: [{ id: "s1", name: "Ann" }], lines: [{ speakerId: "s1", text: "Hello", translation: "Bonjour" }] } });
    expect(screen.getByText("Ann:")).toBeInTheDocument(); expect(screen.getByText("Bonjour")).toBeInTheDocument();
    expect(screen.getByText("Support text").closest("details")).not.toHaveAttribute("open");
  });
});
