// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ReviewHeader from "./reviewHeader";

describe("review header", () => {
    it("shows the overall count, the section done / total beside its bar, and the card facts", () => {
        render(<ReviewHeader kind="Vocabulary" sectionLabel="Vocabulary" sectionProgress={{ done: 4, total: 10 }} current={10} total={13}
            meta={["Lesson: Food", "Created: 10/30/2026", "Last seen: 11/4/2026"]} progressLabel="Review progress" />);
        expect(screen.getByText("10 / 13")).toBeInTheDocument();
        expect(screen.getByText("4 / 10 vocabulary")).toBeInTheDocument();
        expect(screen.getByText("Last seen: 11/4/2026")).toBeInTheDocument();
    });
    it("has no section line without a section", () => {
        render(<ReviewHeader kind="Exercises" current={1} total={2} progressLabel="Review progress" />);
        expect(screen.queryByText(/ exercises$/)).toBeNull();
    });
});
