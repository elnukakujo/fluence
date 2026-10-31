import { describe, expect, it, vi } from "vitest";


describe("flattenElements", () => {
  it("lifts the stored `fields` next to kind/status so review rows can read them", async () => {
    const { flattenElements } = await import("./index");
    const [row] = flattenElements([
      { id: "e1", kind: "grammar", status: "verified", fields: { title: "Le verbe etre", explanation: "Il sert." } } as never,
    ]);
    expect(row).toMatchObject({ id: "e1", kind: "grammar", status: "verified", title: "Le verbe etre", explanation: "Il sert." });
  });
});
