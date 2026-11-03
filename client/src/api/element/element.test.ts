import { afterEach, describe, expect, it, vi } from "vitest";
import { bulkDeleteElements, bulkEditTags, bulkMoveElements } from ".";

const reply = (ok: boolean, body: unknown) => vi.fn().mockResolvedValue({ ok, json: async () => body });
afterEach(() => vi.unstubAllGlobals());

describe("element bulk API", () => {
  it("posts the ids and returns the result", async () => {
    const f = reply(true, { deleted: 2 });
    vi.stubGlobal("fetch", f);
    expect(await bulkDeleteElements(["voc_V1", "gram_G1"])).toEqual({ deleted: 2 });
    expect(f.mock.calls[0][0]).toMatch(/\/api\/elements\/bulk-delete$/);
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ ids: ["voc_V1", "gram_G1"] });
  });
  it("sends the target lesson and the add / remove lists", async () => {
    const f = reply(true, {});
    vi.stubGlobal("fetch", f);
    await bulkMoveElements(["voc_V1"], "lesson_L2");
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ ids: ["voc_V1"], target_lesson_id: "lesson_L2" });
    await bulkEditTags(["voc_V1"], ["tag_T1"], ["tag_T2"]);
    expect(JSON.parse(f.mock.calls[1][1].body)).toEqual({ ids: ["voc_V1"], add: ["tag_T1"], remove: ["tag_T2"] });
  });
  it("throws the server's message", async () => {
    vi.stubGlobal("fetch", reply(false, { error: "Some items are already in that lesson" }));
    await expect(bulkMoveElements(["voc_V1"], "lesson_L1")).rejects.toThrow("already in that lesson");
  });
});
