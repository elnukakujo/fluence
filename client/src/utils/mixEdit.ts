import { scaleMix } from "./scaleMix";

export type Mix = Record<string, number>;

export const placed = (mix: Mix): number => Object.values(mix).reduce((a, n) => a + n, 0);
export const free = (mix: Mix, total: number): number => Math.max(0, total - placed(mix));

/** +1 / −1 on one type with the total fixed: + needs a free slot; − at 1 removes the type; a missing type stays missing on −. */
export function step(mix: Mix, type: string, delta: 1 | -1, total: number): Mix {
    const n = mix[type] ?? 0;
    if (delta === 1) return free(mix, total) > 0 ? { ...mix, [type]: n + 1 } : mix;
    if (n <= 0) return mix;
    const { [type]: _gone, ...rest } = mix;
    return n === 1 ? rest : { ...rest, [type]: n - 1 };
}

/** The offerable types that are not in the mix yet, in the given order. */
export const addable = (types: string[], mix: Mix): string[] => types.filter((t) => !(t in mix));

/** The edited mix resized to a new total, same proportions. */
export const resize = (mix: Mix, total: number): Mix => scaleMix(mix, total);
