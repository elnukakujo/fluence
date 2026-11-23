import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("review motion", () => {
    const css = readFileSync(`${__dirname}/globals.css`, "utf8");
    it("pulse-once and fade-in-group animate only inside prefers-reduced-motion: no-preference", () => {
        const block = css.slice(css.indexOf("@media (prefers-reduced-motion: no-preference)"));
        for (const cls of [".pulse-once", ".fade-in-group"]) {
            expect(css.split(cls + " {").length - 1).toBe(1);                    // defined once...
            expect(block).toContain(cls + " {");                                  // ...inside the no-preference block
        }
    });
});
