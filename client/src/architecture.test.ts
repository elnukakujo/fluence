import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// A ratchet, not a snapshot: KNOWN lists leftovers the refactor did not reach (with the owner of the fix).
// A new offender fails; a KNOWN entry that no longer offends fails too (delete it).
const ROOT = __dirname;
const files = (d: string): string[] => readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? (n === "graphify-out" ? [] : files(p)) : /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
});
const offenders = (re: RegExp, skip: RegExp) =>
    files(ROOT).filter((f) => !skip.test(f) && re.test(readFileSync(f, "utf8"))).map((f) => relative(ROOT, f)).sort();

describe.each([
    ["an element id prefix literal (use elementKindOf)", /startsWith\(["'][a-z]+_["']\)/, /api\/elementKinds\.ts$/,
        ["api/process/index.tsx"]],   // updateScoreById picks a score route per kind; spec 2 makes it one route
    ["a switch on exercise_type (use exerciseTypeInfo)", /switch \(\w+\.exercise_type\)/, /exerciseTypes\.tsx$/,
        ["components/exercises/exerciseFinish.ts"]],   // solutionLines: the solution of a given-up exercise per type
])("no %s outside its registry", (_name, re, skip, known) => {
    it("has no new offender", () => {
        expect(offenders(re, skip).filter((f) => !known.includes(f))).toEqual([]);
    });
    it("lists only real leftovers", () => {
        expect(known.filter((f) => !offenders(re, skip).includes(f))).toEqual([]);
    });
});
