// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import JobControls from "./jobControls";

const api = vi.hoisted(() => ({ stopJob: vi.fn(), pauseJob: vi.fn(), resumeJob: vi.fn() }));
vi.mock("@/api/ingestion", () => api);
vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

describe("JobControls", () => {
  it("the pause button turns into play and back, and stop tells the page", async () => {
    const onStopped = vi.fn();
    render(<JobControls jobId="ing_1" onStopped={onStopped} />);
    await userEvent.click(screen.getByRole("button", { name: "pauseImport" }));
    expect(api.pauseJob).toHaveBeenCalledWith("ing_1");
    await userEvent.click(await screen.findByRole("button", { name: "resumeImport" }));
    expect(api.resumeJob).toHaveBeenCalledWith("ing_1");
    expect(await screen.findByRole("button", { name: "pauseImport" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "stopImport" }));
    expect(api.stopJob).toHaveBeenCalledWith("ing_1");
    expect(onStopped).toHaveBeenCalled();
  });

  it("starts as play when the job is already paused, and shows the server's refusal", async () => {
    api.resumeJob.mockRejectedValueOnce(new Error("nope"));
    render(<JobControls jobId="ing_1" paused />);
    await userEvent.click(screen.getByRole("button", { name: "resumeImport" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("nope");
    expect(screen.getByRole("button", { name: "resumeImport" })).toBeInTheDocument();
  });
});
