// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FeedbackNote from "./feedbackNote";

const SEVEN = ["answering", "essay", "organize", "speaking", "translate", "typeInTheBlank", "conversation"];

describe("FeedbackNote", () => {
    it("renders headline, feedback, level and the expected answer in one order, with a verdict", () => {
        render(<FeedbackNote verdict="wrong" headline="Not quite" message="Mind the verb" level={{ label: "A2", stars: "★★" }} reveal={{ label: "Correct answer", value: "ich heiße" }}>extra line</FeedbackNote>);
        const note = screen.getByTestId("feedback-note");
        expect(note).toHaveAttribute("data-verdict", "wrong");
        expect(note.textContent).toMatch(/Not quite.*Mind the verb.*A2 \(★★\).*Correct answer.*ich heiße.*extra line/);
        expect(screen.getByRole("status")).toBeInTheDocument();
    });
    it("leaves out what is missing", () => {
        render(<FeedbackNote verdict="correct" headline="Well done" />);
        expect(screen.getByTestId("feedback-note").textContent).toBe("Well done");
    });
    it.each(SEVEN)("%s exercise uses it and no private copy of the bubble", (name) => {
        const src = readFileSync(`${__dirname}/${name}Exercise.tsx`, "utf8");
        expect(src).toContain("<FeedbackNote");
        expect(src).not.toContain("<FeedbackPanel");
    });
});
