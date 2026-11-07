/** The suggested mix (type -> n) resized to `count` exercises in total, same proportions (largest remainder; ties go to the bigger share). Types that get 0 are left out. */
export function scaleMix(mix: Record<string, number>, count: number): Record<string, number> {
    const base = Object.entries(mix).filter(([, n]) => n > 0);
    const sum = base.reduce((a, [, n]) => a + n, 0);
    if (!sum || count < 1) return {};
    const rows = base.map(([type, n]) => ({ type, n, exact: (n / sum) * count }))
        .map((r) => ({ ...r, got: Math.floor(r.exact) }));
    let left = count - rows.reduce((a, r) => a + r.got, 0);
    for (const r of [...rows].sort((a, b) => (b.exact - b.got) - (a.exact - a.got) || b.n - a.n)) { if (left-- > 0) r.got++; }
    return Object.fromEntries(rows.filter((r) => r.got > 0).map((r) => [r.type, r.got]));
}
