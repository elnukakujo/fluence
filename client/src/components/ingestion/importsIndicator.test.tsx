// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ImportsIndicator, { indicatorState } from "./importsIndicator";

const jobs = vi.hoisted(() => ({ list: [] as { id: string; status: string; filename: string; pages_done: number; pages_total: number }[] }));
vi.mock("next/link", () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock("@/api/ingestion", () => ({
  ACTIVE_STATUSES: ["queued", "parsing", "extracting"], deleteJob: vi.fn(), listJobs: () => Promise.resolve(jobs.list),
}));

const j = (status: string) => ({ status }) as { status: "ready" };

describe("indicatorState", () => {
  it("running beats needs-you beats ready beats failed", () => {
    expect(indicatorState([j("failed"), j("ready"), j("pages"), j("parsing")])).toBe("running");
    expect(indicatorState([j("failed"), j("ready"), j("structure")])).toBe("attention");
    expect(indicatorState([j("failed"), j("ready")])).toBe("ready");
    expect(indicatorState([j("failed")])).toBe("failed");
    expect(indicatorState([])).toBe("idle");
  });
});

describe("ImportsIndicator", () => {
  it("spins while an import is being read", async () => {
    jobs.list = [{ id: "1", status: "parsing", filename: "a.pdf", pages_done: 0, pages_total: 0 }];
    render(<ImportsIndicator />);
    expect(await screen.findByTestId("spinner")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Imports: import running" })).toBeInTheDocument();
  });
});
