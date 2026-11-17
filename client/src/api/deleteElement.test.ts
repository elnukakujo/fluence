import { describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ del: {} as Record<string, ReturnType<typeof vi.fn>> }));
for (const n of ["Language", "Lesson", "Vocabulary", "Grammar", "Calligraphy", "Exercise", "Tag", "Source"]) m.del[n] = vi.fn().mockResolvedValue(undefined);
for (const k of ["language", "lesson", "vocabulary", "grammar", "calligraphy", "exercise", "tag", "source"]) {
    const n = k[0].toUpperCase() + k.slice(1);
    vi.doMock(`@/api/${k}`, async (orig) => ({ ...(await orig<object>()), [`delete${n}`]: m.del[n] }));
}

describe("deleteElement routes by id prefix", () => {
    const cases: [string, string][] = [["lang_1", "Language"], ["lesson_1", "Lesson"], ["voc_1", "Vocabulary"], ["gram_1", "Grammar"],
        ["call_1", "Calligraphy"], ["ex_1", "Exercise"], ["tag_1", "Tag"], ["src_1", "Source"]];
    it.each(cases)("%s", async (id, name) => {
        const { deleteElement } = await import("./index");
        for (const id2 of [id, id.toUpperCase()]) {
            Object.values(m.del).forEach((f) => f.mockClear());
            await deleteElement(id2);
            expect(m.del[name]).toHaveBeenCalledWith(id2);
            expect(Object.entries(m.del).filter(([k, f]) => k !== name && f.mock.calls.length)).toEqual([]);
        }
    });
    it.each(["char_C1", "zzz_1"])("%s throws", async (id) => {
        const { deleteElement } = await import("./index");
        await expect(deleteElement(id)).rejects.toThrow(`Unknown element type for ID: ${id}`);
    });
});
