// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import StopButton from "./stopButton";

const stopJob = vi.hoisted(() => vi.fn());
vi.mock("@/api/ingestion", () => ({ stopJob }));
vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

describe("StopButton", () => {
  it("stops the job, tells the page, and shows an error if the server refuses", async () => {
    const onStopped = vi.fn();
    stopJob.mockResolvedValueOnce(undefined);
    const { unmount } = render(<StopButton jobId="ing_1" onStopped={onStopped} />);
    await userEvent.click(screen.getByRole("button", { name: "stopImport" }));
    expect(stopJob).toHaveBeenCalledWith("ing_1");
    expect(onStopped).toHaveBeenCalled();
    unmount();
    stopJob.mockRejectedValueOnce(new Error("This import is not running"));
    render(<StopButton jobId="ing_1" />);
    await userEvent.click(screen.getByRole("button", { name: "stopImport" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This import is not running");
  });
});
