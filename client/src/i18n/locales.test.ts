import { describe, it, expect } from "vitest";
import { pickLocale, suggestedLocales, nativeFromLocale } from "./locales";

describe("locales", () => {
  it("falls back from a bad cookie to Accept-Language", () => {
    expect(pickLocale("de", "fr-CA,fr;q=0.9")).toBe("fr");
  });
  it("respects q order and strips region", () => {
    expect(pickLocale(undefined, "zh-CN,zh;q=0.9,en;q=0.8")).toBe("zh");
    expect(pickLocale(undefined, "de;q=0.9,fr;q=0.8,en;q=0.1")).toBe("fr");
    expect(pickLocale(undefined, "en;q=0.2,zh;q=0.9")).toBe("zh");
  });
  it("defaults to en", () => {
    expect(pickLocale("", null)).toBe("en");
    expect(pickLocale(undefined, "de")).toBe("en");
  });
  it("cookie wins", () => {
    expect(pickLocale("zh", "fr")).toBe("zh");
  });
  it("suggests locales from native isos", () => {
    expect(suggestedLocales(["eng", "fra"])).toEqual(["en", "fr"]);
    expect(suggestedLocales(["spa"])).toEqual([]);
  });
  it("maps locale to native iso", () => {
    expect(nativeFromLocale("zh")).toEqual(["zho"]);
  });
});
