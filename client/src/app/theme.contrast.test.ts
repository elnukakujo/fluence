import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "globals.css"), "utf8");
const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
// the light palette is the first `:root`, the dark one the `prefers-color-scheme: dark` block
const light = css.slice(css.indexOf(":root"), css.indexOf("@media (prefers-color-scheme: dark)"));
const dark = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"), css.indexOf("@media (prefers-color-scheme: dark)") + 800);
const get = (block: string, name: string) => block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))![1];

describe("secondary text keeps WCAG AA (4.5:1) on every surface", () => {
    for (const [name, block, fallback] of [["light", light, null], ["dark", dark, light]] as const) {
        it(`${name} theme: --muted on --background and --surface`, () => {
            const muted = get(block, "muted");
            const bg = block.includes("--background") ? get(block, "background") : get(fallback!, "background");
            const surface = block.includes("--surface") ? get(block, "surface") : get(fallback!, "surface");
            expect(ratio(muted, bg)).toBeGreaterThanOrEqual(4.5);
            expect(ratio(muted, surface)).toBeGreaterThanOrEqual(4.5);
        });
    }
});
