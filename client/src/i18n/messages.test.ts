import { describe, it, expect } from "vitest";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import zh from "../../messages/zh.json";

const flat = (o: Record<string, unknown>, p = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" ? flat(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`],
  );

describe("message parity", () => {
  const base = flat(en);
  for (const [name, msgs] of [["fr", fr], ["zh", zh]] as const) {
    it(`${name} has every en key`, () => {
      const have = new Set(flat(msgs));
      expect(base.filter((k) => !have.has(k))).toEqual([]);
    });
  }
});
