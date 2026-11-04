import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("..", () => ({ BASE_URL: "", getAuthHeaders: async () => ({}) }));
const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body });

describe("acceptLesson", () => {
  afterEach(() => vi.useRealTimers());

  it("starts the add in the background and polls until it is done, reporting n / total", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockReturnValueOnce(json({ state: "running", done: 0, total: 4 }, 202))
      .mockReturnValueOnce(json({ state: "running", done: 2, total: 4 }))
      .mockReturnValueOnce(json({ state: "done", done: 4, total: 4, result: { lesson_id: "lesson_1", created: 3, created_elements: 1 } }));
    vi.stubGlobal("fetch", fetchMock);
    const { acceptLesson } = await import("./index");
    const seen: number[] = [];
    const promise = acceptLesson("j", 0, [], undefined, undefined, (d) => seen.push(d));
    await vi.advanceTimersByTimeAsync(2000);
    expect(await promise).toMatchObject({ lesson_id: "lesson_1", created: 3 });
    expect(seen).toEqual([0, 2, 4]);
    expect(fetchMock.mock.calls[0][0]).toContain("?background=1");
  });

  it("throws the server's reason when the background add fails", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(json({ state: "running", done: 0, total: 1 }, 202))
      .mockReturnValueOnce(json({ state: "failed", done: 0, total: 1, error: "boom" })));
    const { acceptLesson } = await import("./index");
    const promise = acceptLesson("j", 0, [], undefined, undefined);
    const caught = promise.catch((e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await caught).toBe("boom");
  });
});
