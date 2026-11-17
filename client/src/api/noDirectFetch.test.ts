import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const walk = (d: string): string[] => readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? (n === "graphify-out" ? [] : walk(p)) : /\.tsx?$/.test(n) ? [p] : [];
});

it("nothing outside apiFetch.ts calls fetch directly", () => {
    const offenders = walk(join(__dirname, ".."))
        .filter((f) => !/apiFetch\.ts$|\.test\.tsx?$/.test(f))
        .filter((f) => /\bfetch\(/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
});
