import { beforeEach, describe, expect, it, vi } from "vitest";

// Server-rendered pages call these without a browser, so the session cookie must be forwarded by hand;
// without it the backend answers 401 and the page fails.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (name === "session_token" ? { value: "tok123" } : undefined) }) }));

import { getCharacterById } from "./character";
import { getPassageById } from "./passage";
import { getWordById } from "./word";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", fetchMock);
});

describe.each([
  ["word", () => getWordById("word_W1"), "/api/word/word_W1"],
  ["character", () => getCharacterById("char_C1"), "/api/character/char_C1"],
  ["passage", () => getPassageById("pass_P1"), "/api/passage/pass_P1"],
])("get %s by id", (_name, call, path) => {
  it("forwards the session cookie so the backend does not answer 401", async () => {
    await call();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(path);
    expect(init?.headers?.Cookie).toBe("session_token=tok123");
  });
});
