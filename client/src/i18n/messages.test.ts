import { describe, it, expect } from "vitest";
import { loadMessages } from "./loadMessages";

const flat = (o: Record<string, unknown>, p = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" ? flat(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`],
  );

describe("message parity", () => {
  const base = flat(loadMessages("en"));
  for (const name of ["fr", "zh"]) {
    it(`${name} has every en key`, () => {
      const have = new Set(flat(loadMessages(name)));
      expect(base.filter((k) => !have.has(k))).toEqual([]);
    });
    it(`${name} has no extra keys`, () => {
      const en = new Set(base);
      expect(flat(loadMessages(name)).filter((k) => !en.has(k))).toEqual([]);
    });
  }
});
