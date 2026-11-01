// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ImportsIndicator, { indicatorState, ringGeometry } from "./importsIndicator";

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
    expect(screen.getByRole("button", { name: "Imports: import running, Step 1 of 3, 1 running" })).toBeInTheDocument();
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
  const arcs = (ring: HTMLElement) => [...ring.querySelectorAll("circle[data-arc]")].map((c) => [c.getAttribute("data-arc"), c.getAttribute("data-status"), c.getAttribute("stroke-dasharray")]);

  it("draws finished steps in one arc and the running step as a second arc filled by pages read", async () => {
    jobs.list = [{ id: "1", status: "extracting", filename: "a.pdf", pages_done: 5, pages_total: 10 }];
    render(<ImportsIndicator />);
    expect(arcs(await screen.findByTestId("step-ring"))).toEqual([["done", null, "200 300"], ["current", "running", "50 300"]]);
  });

  it("ringGeometry: where the arcs end for each state", () => {
    expect(ringGeometry(2, "attention", 0)).toEqual({ done: 100, current: 100, status: "attention" });
    expect(ringGeometry(1, "failed", 0)).toEqual({ done: 0, current: 100, status: "failed" });
    expect(ringGeometry(3, "ready", 0)).toEqual({ done: 300, current: 0, status: "done" });
    expect(ringGeometry(1, "running", 0).current).toBeGreaterThan(0);   // always a visible sliver while starting
    expect(ringGeometry(3, "running", 0.6)).toEqual({ done: 200, current: 60, status: "running" });
  });

  it("is an icon-only button whose name carries state, step and count; no ring when nothing is pending", async () => {
    jobs.list = [{ id: "1", status: "structure", filename: "a.pdf", pages_done: 0, pages_total: 0 }];
    const { unmount } = render(<ImportsIndicator />);
    const btn = await screen.findByRole("button", { name: "Imports: import waiting for you, Step 2 of 3" });
    expect(btn).toHaveAttribute("title", "Imports: import waiting for you, Step 2 of 3");
    expect(btn).not.toHaveTextContent(/Imports/);
    unmount();
    jobs.list = [{ id: "2", status: "ready", finished: true, filename: "b.pdf", pages_done: 0, pages_total: 0 } as never];
    render(<ImportsIndicator />);
    await screen.findByRole("button", { name: /Imports/ });
    expect(screen.queryByTestId("step-ring")).toBeNull();
  });

  it("puts the count in the accessible name, not in a competing badge announcement", async () => {
    jobs.list = [{ id: "1", status: "parsing", filename: "a.pdf", pages_done: 0, pages_total: 0 }, { id: "2", status: "extracting", filename: "b.pdf", pages_done: 1, pages_total: 4 }];
    render(<ImportsIndicator />);
    expect(await screen.findByRole("button", { name: "Imports: import running, Step 1 of 3, 2 running" })).toBeInTheDocument();
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

describe("reading progress in the menu", () => {
  it("says how many pages the parser has read so far", async () => {
    jobs.list = [{ id: "1", status: "parsing", filename: "a.pdf", pages_done: 4, pages_total: 12 }];
    render(<ImportsIndicator />);
    await userEvent.click(await screen.findByRole("button", { name: /Imports/ }));
    expect(screen.getByText(/Reading… · 4 of 12 pages read/)).toBeInTheDocument();
  });

  it("shows nothing extra before the parser reports a page count", async () => {
    jobs.list = [{ id: "1", status: "parsing", filename: "a.pdf", pages_done: 0, pages_total: 0 }];
    render(<ImportsIndicator />);
    await userEvent.click(await screen.findByRole("button", { name: /Imports/ }));
    expect(screen.queryByText(/pages read/)).toBeNull();
  });
});
