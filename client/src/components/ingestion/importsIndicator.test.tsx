// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import ImportsIndicator, { indicatorState } from "./importsIndicator";

const jobs = vi.hoisted(() => ({ list: [] as { id: string; status: string; filename: string; pages_done: number; pages_total: number }[] }));
vi.mock("next/link", () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock("@/api/ingestion", () => ({
  ACTIVE_STATUSES: ["queued", "parsing", "extracting"], INGESTION_CHANGED: "ingestion:changed", deleteJob: vi.fn(), listJobs: () => Promise.resolve(jobs.list),
}));

const j = (status: string) => ({ status }) as { status: "ready" };

describe("indicatorState", () => {
  it("running beats needs-you beats ready beats failed", () => {
    expect(indicatorState([j("failed"), j("ready"), j("pages"), j("parsing")])).toBe("running");
    expect(indicatorState([j("failed"), j("ready"), j("structure")])).toBe("attention");
    expect(indicatorState([j("failed"), j("ready")])).toBe("ready");
    expect(indicatorState([j("failed")])).toBe("failed");
    expect(indicatorState([])).toBe("idle");
    expect(indicatorState([{ status: "ready", finished: true }])).toBe("idle");   // everything added: not pending work
    expect(indicatorState([{ status: "ready", finished: true }, { status: "failed" }])).toBe("failed");
  });
});

describe("ImportsIndicator", () => {
  it("spins while an import is being read", async () => {
    jobs.list = [{ id: "1", status: "parsing", filename: "a.pdf", pages_done: 0, pages_total: 0 }];
    render(<ImportsIndicator />);
    expect(await screen.findByTestId("spinner")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Imports: import running, Step 1 of 3" })).toBeInTheDocument();
  });

  it("shows the step bar per import and closes the menu when the user clicks elsewhere or presses Escape", async () => {
    jobs.list = [{ id: "1", status: "structure", filename: "a.pdf", pages_done: 0, pages_total: 0 }];
    render(<div><ImportsIndicator /><p>elsewhere</p></div>);
    await userEvent.click(await screen.findByRole("button", { name: /Imports/ }));
    expect(screen.getByText("Step 2 of 3 · Choose the lessons")).toBeInTheDocument();
    await userEvent.click(screen.getByText("elsewhere"));
    expect(screen.queryByText("a.pdf")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Imports/ }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByText("a.pdf")).toBeNull();
  });

  it("does not call a finished import pending", async () => {
    jobs.list = [{ id: "1", status: "ready", finished: true, filename: "a.pdf", pages_done: 0, pages_total: 0 } as never];
    render(<ImportsIndicator />);
    expect(await screen.findByRole("button", { name: "Imports: no active import" })).toBeInTheDocument();
  });
});

describe("StepRing", () => {
  beforeAll(() => {   // jsdom has no layout: give elements a size so the ring can measure the button
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, value: 100 });
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 44 });
  });
  it("fills finished steps and the current one by pages read", async () => {
    jobs.list = [{ id: "1", status: "extracting", filename: "a.pdf", pages_done: 5, pages_total: 10 }];
    render(<ImportsIndicator />);
    const ring = await screen.findByTestId("step-ring");
    const filled = [...ring.querySelectorAll("rect[data-step]")].map((r) => [r.getAttribute("data-step"), r.getAttribute("stroke-dasharray")]);
    expect(filled).toEqual([["1", "94 300"], ["2", "94 300"], ["3", "47 300"]]);   // steps 1+2 done, step 3 half-read
  });

  it("shows the step in the tooltip / accessible name, and no ring when nothing is pending", async () => {
    jobs.list = [{ id: "1", status: "structure", filename: "a.pdf", pages_done: 0, pages_total: 0 }];
    const { unmount } = render(<ImportsIndicator />);
    expect(await screen.findByRole("button", { name: "Imports: import waiting for you, Step 2 of 3" })).toHaveAttribute("title", "Step 2 of 3");
    unmount();
    jobs.list = [{ id: "2", status: "ready", finished: true, filename: "b.pdf", pages_done: 0, pages_total: 0 } as never];
    render(<ImportsIndicator />);
    await screen.findByRole("button", { name: /Imports/ });
    expect(screen.queryByTestId("step-ring")).toBeNull();
  });
});

describe("focusJob", () => {
  it("prefers running over needs-you over ready, ignoring finished imports", async () => {
    const { focusJob } = await import("./importsIndicator");
    const mk = (id: string, status: string, finished = false) => ({ id, status, finished }) as never;
    expect(focusJob([mk("a", "ready"), mk("b", "pages"), mk("c", "parsing")])).toMatchObject({ id: "c" });
    expect(focusJob([mk("a", "ready", true), mk("b", "failed")])).toMatchObject({ id: "b" });
    expect(focusJob([mk("a", "ready", true)])).toBeUndefined();
  });
});
