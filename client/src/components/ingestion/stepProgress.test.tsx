// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StepProgress from "./stepProgress";

describe("StepProgress", () => {
  it("says which of the 3 steps this is and fills the bar to it", () => {
    render(<StepProgress step={2} second="Choose the pages" />);
    expect(screen.getByText("Step 2 of 3 · Choose the pages")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
  });
});
