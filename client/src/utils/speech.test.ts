// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { bcp47, speak } from "./speech";

afterEach(() => { vi.unstubAllGlobals(); delete (window as unknown as Record<string, unknown>).speechSynthesis; });

describe("speech", () => {
  it("maps ISO 639-2/T codes and leaves unknown ones undefined", () => {
    expect(bcp47("jpn")).toBe("ja");
    expect(bcp47("xyz")).toBeUndefined();
    expect(bcp47(undefined)).toBeUndefined();
  });
  it("reports false when the browser has no speech synthesis", () => {
    expect(speak("a")).toBe(false);
  });
  it("speaks once with the language when available", () => {
    const synth = { speak: vi.fn(), cancel: vi.fn() };
    vi.stubGlobal("SpeechSynthesisUtterance", class { lang = ""; constructor(public text: string) {} });
    (window as unknown as Record<string, unknown>).speechSynthesis = synth;
    expect(speak("こんにちは", "ja")).toBe(true);
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(synth.speak.mock.calls[0][0]).toMatchObject({ text: "こんにちは", lang: "ja" });
  });
  it("uses an installed voice of the language when there is one", () => {
    const ja = { lang: "ja-JP", name: "Kyoko" }, en = { lang: "en-US", name: "Alex" };
    const synth = { speak: vi.fn(), cancel: vi.fn(), getVoices: () => [en, ja] };
    vi.stubGlobal("SpeechSynthesisUtterance", class { lang = ""; voice: unknown = null; constructor(public text: string) {} });
    (window as unknown as Record<string, unknown>).speechSynthesis = synth;
    speak("犬", "ja");
    expect(synth.speak.mock.calls[0][0].voice).toBe(ja);
  });
});
