import type { VocSidePattern } from "@/interface/systemData/UserPreferences";

/** The vocabulary mix as two independent settings: how often each side shows (ratio) and how they interleave (order). */
export type SideOrder = "random" | "alternate" | "blocks";
export interface SideParts { front: number; back: number; order: SideOrder }

export const MAX_RATIO = 9;

/** A stored pattern as ratio + order. null (never set) is the default, random 1:1. */
export function splitPattern(p: VocSidePattern | null | undefined): SideParts {
    if (!p) return { front: 1, back: 1, order: "random" };
    if (p.mode === "random") return { front: p.front, back: p.back, order: "random" };
    if (p.mode === "split") return { front: 1, back: 1, order: "blocks" };
    const front = p.cycle.filter((c) => c === "F").length;
    return { front, back: p.cycle.length - front, order: "alternate" };
}

/** Ratio + order as a stored pattern; null when the ratio is invalid (not two non-negative integers, or 0:0). Blocks ignore the ratio. */
export function joinPattern({ front, back, order }: SideParts): VocSidePattern | null {
    if (order === "blocks") return { mode: "split" };
    const ok = (n: number) => Number.isInteger(n) && n >= 0;
    if (!ok(front) || !ok(back) || front + back === 0) return null;
    if (order === "random") return { mode: "random", front, back };
    // ponytail: "in turns" is front x a then back x b; arbitrary sequences (FBBF...) are no longer editable
    return { mode: "cycle", cycle: [...Array<"F">(front).fill("F"), ...Array<"B">(back).fill("B")] };
}
