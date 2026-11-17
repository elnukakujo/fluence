import { afterEach, describe, expect, it, vi } from "vitest";
import ConflictError from "./conflictError";
import { ApiError, apiFetch } from "./apiFetch";

const reply = (status: number, body?: string) => vi.fn().mockImplementation(async () => new Response(body, { status }));
afterEach(() => vi.unstubAllGlobals());

describe("apiFetch", () => {
    it("returns parsed json", async () => {
        vi.stubGlobal("fetch", reply(200, '{"a":1}'));
        expect(await apiFetch("/api/x", { errorMessage: "Failed" })).toEqual({ a: 1 });
    });
    it("returns undefined on 204 and on empty body", async () => {
        vi.stubGlobal("fetch", reply(204));
        expect(await apiFetch("/api/x", { errorMessage: "Failed" })).toBeUndefined();
        vi.stubGlobal("fetch", reply(200, ""));
        expect(await apiFetch("/api/x", { errorMessage: "Failed" })).toBeUndefined();
    });
    it("throws ApiError with status, message=errorMessage and serverMessage from {error}", async () => {
        vi.stubGlobal("fetch", reply(400, '{"error":"bad"}'));
        const e = await apiFetch("/api/x", { errorMessage: "Failed to x" }).catch((e) => e);
        expect(e).toBeInstanceOf(ApiError);
        expect(e).toMatchObject({ status: 400, message: "Failed to x", serverMessage: "bad" });
    });
    it("tolerates a non-json error body", async () => {
        vi.stubGlobal("fetch", reply(500, "<html>"));
        expect(await apiFetch("/api/x", { errorMessage: "F" }).catch((e) => e)).toMatchObject({ status: 500, serverMessage: undefined });
    });
    it("409 with conflict:true throws ConflictError", async () => {
        const payload = { entity_type: "word", existing: { id: "w1" }, incoming: {}, diff: [] };
        vi.stubGlobal("fetch", reply(409, JSON.stringify(payload)));
        await expect(apiFetch("/api/x", { errorMessage: "F", conflict: true })).rejects.toBeInstanceOf(ConflictError);
    });
    it("409 without conflict is a plain ApiError", async () => {
        vi.stubGlobal("fetch", reply(409, "{}"));
        await expect(apiFetch("/api/x", { errorMessage: "F" })).rejects.toBeInstanceOf(ApiError);
    });
    it("sends JSON bodies with the auth headers; FormData sends no Content-Type", async () => {
        const f = reply(200, "{}");
        vi.stubGlobal("fetch", f);
        await apiFetch("/api/x", { method: "POST", body: { a: 1 }, errorMessage: "F" });
        expect(f.mock.calls[0][1]).toMatchObject({ method: "POST", body: '{"a":1}', headers: { "Content-Type": "application/json" } });
        await apiFetch("/media/up", { method: "POST", body: new FormData(), errorMessage: "F" });
        expect(f.mock.calls[1][1].headers).not.toHaveProperty("Content-Type");
        expect(f.mock.calls[1][1].body).toBeInstanceOf(FormData);
    });
    it("absolute urls are fetched as-is without auth headers", async () => {
        const f = reply(200, "{}");
        vi.stubGlobal("fetch", f);
        await apiFetch("https://cdn.example/x.json", { errorMessage: "F" });
        expect(f.mock.calls[0][0]).toBe("https://cdn.example/x.json");
        expect(f.mock.calls[0][1].headers).toBeUndefined();
    });
    it("raw:true returns the Response; !ok still throws ApiError", async () => {
        vi.stubGlobal("fetch", reply(200, "{}"));
        expect(await apiFetch("/api/x", { errorMessage: "F", raw: true })).toBeInstanceOf(Response);
        vi.stubGlobal("fetch", reply(404, "{}"));
        await expect(apiFetch("/api/x", { errorMessage: "F", raw: true })).rejects.toBeInstanceOf(ApiError);
    });
    it("network failure rejects with the original error", async () => {
        const boom = new TypeError("down");
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(boom));
        await expect(apiFetch("/api/x", { errorMessage: "F" })).rejects.toBe(boom);
    });
});
