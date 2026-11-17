import { describe, expect, it } from "vitest";
import { radicalsOf } from "./characterLinks";

const all = [
    { id: "c1", character: "河", key_radical_id: "c3" },
    { id: "c2", character: "湖", key_radical_id: "c3" },
    { id: "c3", character: "氵" },
    { id: "c4", character: "木" },
];

describe("radicalsOf", () => {
    it("lists each key radical once, resolved to its character", () => {
        expect(radicalsOf([{ id: "c1" }, { id: "c2" }], all)).toEqual([{ id: "c3", character: "氵" }]);
    });
    it("skips characters without a linked radical and unknown ids", () => {
        expect(radicalsOf([{ id: "c4" }, { id: "nope" }], all)).toEqual([]);
        expect(radicalsOf(undefined, all)).toEqual([]);
    });
});
