// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type Exercise from "@/interface/features/Exercise";
import ExerciseStatus from "./exerciseStatus";

const show = async (e: Partial<Exercise>) => render(await ExerciseStatus({ exercise: e as Exercise }));

describe("exercise status badges", () => {
  it("marks an AI-generated exercise with text, not colour alone", async () => {
    await show({ generation_batch_id: "batch_1", needs: [] });
    expect(screen.getByText("AI-generated")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("a hand-made exercise has no such badge", async () => {
    await show({ needs: [] });
    expect(screen.queryByText("AI-generated")).toBeNull();
  });

  it("an exercise waiting for review is not ready and says it needs review", async () => {
    await show({ generation_batch_id: "b", review_reason: "x", needs: ["review"] });
    expect(screen.getByText(/Missing: review/)).toBeInTheDocument();
  });
});
