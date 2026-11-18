import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../apiFetch";
import { getLanguageSummary } from ".";

vi.mock("..", () => ({ BASE_URL: "http://api", getAuthHeaders: async () => ({}) }));
afterEach(() => vi.unstubAllGlobals());

describe("getLanguageSummary", () => {
    it("asks for one language's summary, never cached", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response('{"id":"lang_L1","due":3}', { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);
        expect(await getLanguageSummary("lang_L1")).toMatchObject({ id: "lang_L1", due: 3 });
        expect(fetchMock.mock.calls[0][0]).toBe("http://api/api/stats/lang_L1/summary");
        expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
    });
    it("surfaces a 404 as ApiError so the page can fall back", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"error":"Not found"}', { status: 404 })));
        await expect(getLanguageSummary("lang_X")).rejects.toBeInstanceOf(ApiError);
    });
});
