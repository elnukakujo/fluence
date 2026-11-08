// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import LineAudioButton from "./lineAudioButton";

describe("LineAudioButton", () => {
  it("plays its line", async () => {
    const audio = { hasAudio: () => true, play: vi.fn(), toast: null };
    render(<LineAudioButton audio={audio} line={{ audioIndex: 0 }} label="Play line 1" />);
    await userEvent.click(screen.getByRole("button", { name: "Play line 1" }));
    expect(audio.play).toHaveBeenCalledWith({ audioIndex: 0 });
  });

  it("renders nothing without a clip", () => {
    const audio = { hasAudio: () => false, play: vi.fn(), toast: null };
    const { container } = render(<LineAudioButton audio={audio} line={{ audioIndex: null }} label="x" />);
    expect(container).toBeEmptyDOMElement();
  });
});
