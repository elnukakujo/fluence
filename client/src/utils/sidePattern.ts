import type { VocSidePattern } from "@/interface/systemData/UserPreferences";

export const SIDE_PRESETS = {
    random: { mode: "random", front: 1, back: 1 },
    alternate: { mode: "cycle", cycle: ["F", "B"] },
    twoFrontOneBack: { mode: "cycle", cycle: ["F", "F", "B"] },
    oneFrontTwoBack: { mode: "cycle", cycle: ["F", "B", "B"] },
    split: { mode: "split" },
} as const satisfies Record<string, VocSidePattern>;

export type SidePresetKey = keyof typeof SIDE_PRESETS;

/** The preset a stored pattern equals, or "custom". null (never set) means the default, random 1:1. */
export function presetKeyOf(pattern: VocSidePattern | null | undefined): SidePresetKey | "custom" {
    const p = pattern ?? SIDE_PRESETS.random;
    const found = (Object.keys(SIDE_PRESETS) as SidePresetKey[]).find((k) => JSON.stringify(SIDE_PRESETS[k]) === JSON.stringify(p));
    return found ?? "custom";
}

/** "FFB" / "f f b" -> ["F","F","B"]; null when empty or any other letter. */
export function parseCycle(text: string): ("F" | "B")[] | null {
    const letters = text.toUpperCase().replace(/[\s,]/g, "").split("");
    return letters.length > 0 && letters.every((c) => c === "F" || c === "B") ? (letters as ("F" | "B")[]) : null;
}

/** A custom ratio is valid with two non-negative integers that are not both 0. */
export function ratioPattern(front: number, back: number): VocSidePattern | null {
    const ok = (n: number) => Number.isInteger(n) && n >= 0;
    return ok(front) && ok(back) && front + back > 0 ? { mode: "random", front, back } : null;
}
