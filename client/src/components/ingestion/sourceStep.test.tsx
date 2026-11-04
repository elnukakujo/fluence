// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SourceStep, { type SourceStepData } from "./sourceStep";

describe("source step level", () => {
  it("sends the 0-based level index, as lessons store it: N4 is 1, and the default is the first level (N5 = 0)", async () => {
    const onChange = vi.fn();
    render(<SourceStep filename="genki.pdf" onSourceChange={onChange} languageCode="jpn" showLevel />);
    const last = () => (onChange.mock.calls.at(-1)![0] as SourceStepData).level;
    expect(last()).toBe(0);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /level/i }), "N4");
    expect(last()).toBe(1);
  });
});
