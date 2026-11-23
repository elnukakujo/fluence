import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ load: vi.fn().mockResolvedValue(null), audios: [] as { src: string; preload: string }[] }));
vi.mock("@/lib/calligraphy/strokeData", () => ({ loadStrokeData: m.load }));
vi.mock("@/api", () => ({ PUBLIC_BASE_URL: "http://x" }));

import { preloadAhead } from "./lookAhead";

const call = (ch: string) => ({ id: `call_${ch}`, character: { character: ch } }) as never;
const voc = (id: string, files: string[]) => ({ id, audio_files: files }) as never;

beforeEach(() => {
    m.load.mockClear(); m.audios.length = 0;
    vi.stubGlobal("Audio", class { src = ""; preload = ""; constructor(src?: string) { if (src) this.src = src; m.audios.push(this); } });
});

describe("preloadAhead", () => {
    it("asks for the strokes of the next two calligraphy cards only (loadStrokeData caches per character)", () => {
        const cards = [call("水"), call("火"), call("木"), call("金")];
        preloadAhead(cards, 0);
        expect(m.load.mock.calls.map((c) => c[0])).toEqual(["火", "木"]);          // the current card loads itself; the next two ahead
    });
    it("preloads the first audio file of the next two cards and never the same file twice", () => {
        const cards = [voc("a", []), voc("b", ["/m/b.mp3"]), voc("c", ["/m/c.mp3", "/m/c2.mp3"]), voc("d", ["/m/d.mp3"])];
        preloadAhead(cards, 0);
        preloadAhead(cards, 1);
        expect(m.audios.map((a) => a.src)).toEqual(["http://x/m/b.mp3", "http://x/m/c.mp3", "http://x/m/d.mp3"]);
        expect(m.audios.every((a) => a.preload === "auto")).toBe(true);
    });
    it("does nothing at the end of the queue", () => {
        preloadAhead([call("水")], 0);
        expect(m.load).not.toHaveBeenCalled();
    });
});
