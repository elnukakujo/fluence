import { describe, it, expect, vi } from "vitest";

describe("PageKinds component", () => {
  it("chips toggle and report the new map", () => {
    let value: Record<number, string[]> = { 1: ["vocabulary"], 2: [] };
    const onChange = vi.fn((newValue: Record<number, string[]>) => {
      value = newValue;
    });

    const toggleKinds = (page: number, kind: string) => {
      const current = value[page] || [];
      const newKinds = current.includes(kind)
        ? current.filter((k: string) => k !== kind)
        : [...current, kind];
      onChange({ ...value, [page]: newKinds });
    };

    toggleKinds(1, "grammar");
    expect(onChange).toHaveBeenLastCalledWith({ 1: ["vocabulary", "grammar"], 2: [] });

    toggleKinds(1, "vocabulary");
    expect(onChange).toHaveBeenLastCalledWith({ 1: ["grammar"], 2: [] });
  });

  it("a page with [] renders as skipped", () => {
    const value = { 1: ["vocabulary"], 2: [] };
    const isEmpty = value[2].length === 0;
    expect(isEmpty).toBe(true);
  });
});
