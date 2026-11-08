// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import RunnerBoundary from "./runnerBoundary";

const Boom = () => { throw new Error("bad content"); };

describe("RunnerBoundary", () => {
    it("shows a skip button instead of throwing when the exercise breaks", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const onSkip = vi.fn();
        render(<RunnerBoundary onSkip={onSkip} message="Broken" skipLabel="Skip"><Boom /></RunnerBoundary>);
        expect(screen.getByRole("alert")).toHaveTextContent("Broken");
        fireEvent.click(screen.getByText("Skip"));
        expect(onSkip).toHaveBeenCalled();
    });
    it("renders a healthy child untouched", () => {
        render(<RunnerBoundary onSkip={() => {}} message="Broken" skipLabel="Skip"><p>fine</p></RunnerBoundary>);
        expect(screen.getByText("fine")).toBeInTheDocument();
    });
});
