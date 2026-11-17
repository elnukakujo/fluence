// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type Lesson from "@/interface/containers/Lesson";
import LessonHeaderCard from "./lessonHeaderCard";

const lesson = { id: "lesson_1", title: "Greetings", description: "Say hello." } as unknown as Lesson;

describe("lesson hero", () => {
    it("shows the title, the description, how much of each kind the lesson holds, and the main action", () => {
        render(<LessonHeaderCard lesson={lesson} counts={{ voc: 6, gram: 2, call: 0, ex: 3 }}><button>Review this lesson</button></LessonHeaderCard>);
        expect(screen.getByRole("heading", { name: "Greetings" })).toBeInTheDocument();
        expect(screen.getByText("Say hello.")).toBeInTheDocument();
        const contents = screen.getByRole("list", { name: "Contents of this lesson" });
        expect(within(contents).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["6Vocabulary", "2Grammar", "0Calligraphy", "3Exercises"]);
        expect(screen.getByRole("button", { name: "Review this lesson" })).toBeInTheDocument();
    });

    it("renders without counts or description", () => {
        render(<LessonHeaderCard lesson={{ id: "l", title: "Bare" } as unknown as Lesson} />);
        expect(screen.getByRole("heading", { name: "Bare" })).toBeInTheDocument();
        expect(screen.queryByRole("list")).toBeNull();
    });
});
