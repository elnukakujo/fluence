// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ jobs: [] as { id: string; status: string; filename: string; pages_done: number; pages_total: number }[], calls: 0 }));
vi.mock("next/link", () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock("@/api/ingestion", () => ({
  ACTIVE_STATUSES: ["queued", "parsing", "extracting"],
  INGESTION_CHANGED: "ingestion:changed",
  deleteJob: vi.fn(),
  listJobs: () => { state.calls++; return Promise.resolve(state.jobs); },
}));

import ImportsIndicator, { POLL_ACTIVE_MS, POLL_IDLE_MS } from "./importsIndicator";

const tick = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const job = (status: string) => [{ id: "1", status, filename: "a.pdf", pages_done: 0, pages_total: 0 }];

describe("ImportsIndicator polling", () => {
  beforeEach(() => { vi.useFakeTimers(); state.calls = 0; });
  afterEach(() => vi.useRealTimers());

  it("polls every few seconds while a job is progressing", async () => {
    state.jobs = job("parsing");
    render(<ImportsIndicator />);
    await tick(0);
    const first = state.calls;
    await tick(POLL_ACTIVE_MS * 3);
    expect(state.calls - first).toBe(3);
  });

  it("backs off to the idle interval when nothing is running", async () => {
    state.jobs = job("ready");
    render(<ImportsIndicator />);
    await tick(0);
    const first = state.calls;
    await tick(POLL_ACTIVE_MS * 6);
    expect(state.calls).toBe(first);            // 30s with nothing running: no extra call
    await tick(POLL_IDLE_MS);
    expect(state.calls).toBe(first + 1);
  });

  it("refreshes immediately when this tab changes a job", async () => {
    state.jobs = [];
    render(<ImportsIndicator />);
    await tick(0);
    const first = state.calls;
    state.jobs = job("parsing");
    await act(async () => { window.dispatchEvent(new Event("ingestion:changed")); });
    await tick(0);
    expect(state.calls).toBe(first + 1);
  });
});
