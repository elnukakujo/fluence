import { afterEach, describe, expect, it, vi } from "vitest";
import { generateLineAudio, getGeneration, startGeneration } from ".";

const reply = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });
afterEach(() => vi.unstubAllGlobals());

describe("exercise generation API errors", () => {
  it("throws the server's code, not the fixed fallback text", async () => {
    vi.stubGlobal("fetch", reply(409, { error: "text_gen_not_configured" }));
    await expect(startGeneration("lesson_L1", 3)).rejects.toThrow("text_gen_not_configured");
    vi.stubGlobal("fetch", reply(409, { error: "tts_not_configured" }));
    await expect(generateLineAudio("ex_E1", 0)).rejects.toThrow("tts_not_configured");
  });
  it("turns a 404 on a job poll into 'lost'", async () => {
    vi.stubGlobal("fetch", reply(404, { error: "Unknown job" }));
    await expect(getGeneration("job_1")).rejects.toThrow("lost");
  });
});
