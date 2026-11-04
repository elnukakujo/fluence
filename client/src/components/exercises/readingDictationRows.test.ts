import { describe, expect, it } from "vitest";
import { dictationContent, dictationRows, readingContent, readingRows } from "./readingDictationRows";

describe("reading rows", () => {
  it("builds speakers from distinct names, in order, with ids", () => {
    const c = readingContent([
      { speaker: "A", text: "こんにちは", translation: "Hello", audioIndex: null },
      { speaker: "B", text: "やあ", translation: "", audioIndex: 3 },
      { speaker: "A", text: "元気？", translation: "", audioIndex: null }]);
    expect(c.speakers).toEqual([{ id: "s1", name: "A" }, { id: "s2", name: "B" }]);
    expect(c.lines.map((l) => l.speakerId)).toEqual(["s1", "s2", "s1"]);
    expect(c.lines[1]).toMatchObject({ translation: null, audioIndex: 3 });
  });
  it("uses one default speaker for blank names and round-trips to blank", () => {
    const c = readingContent([{ speaker: " ", text: "本文", translation: "", audioIndex: null }]);
    expect(c.speakers).toHaveLength(1);
    expect(readingRows(c)[0]).toMatchObject({ speaker: "", text: "本文" });
  });
});

describe("dictation rows", () => {
  it("round-trips and keeps audioIndex", () => {
    const c = dictationContent([{ text: " 犬 ", audioIndex: 2 }]);
    expect(c).toEqual({ lines: [{ text: "犬", audioIndex: 2 }] });
    expect(dictationRows(c)).toEqual([{ text: "犬", audioIndex: 2 }]);
  });
  it("does not read a reading content as dictation rows", () => {
    expect(dictationRows(readingContent([{ speaker: "A", text: "x", translation: "", audioIndex: null }]))).toEqual([{ text: "", audioIndex: null }]);
  });
});
