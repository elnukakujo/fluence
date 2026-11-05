"use client";

import ProgressBar from "@/components/ui/progressBar";

/** Compact header of a review card: what it is, overall position, and two thin bars: the whole review (primary)
 *  and the current section (accent, with its done / total). */
export default function ReviewHeader({ kind, side, sectionProgress, sectionLabel, current, total, meta = [], progressLabel }: {
    kind: string;
    side?: string;
    sectionProgress?: { done: number; total: number };
    sectionLabel?: string;
    current: number;
    total: number;
    /** Small facts about the card: lesson, created, last seen. */
    meta?: string[];
    progressLabel: string;
}) {
    return (
        <header className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
                <span className="badge">{kind}</span>
                {side && <span className="badge">{side}</span>}
                <span className="ml-auto text-sm tabular-nums text-muted">{current} / {total}</span>
            </div>
            <ProgressBar current={current} total={total} showLabel={false} showPercent={false} ariaLabel={progressLabel} title={`${current} / ${total}`} />
            {sectionProgress && (
                <div className="flex items-center gap-3">
                    <ProgressBar accent className="flex-1" current={sectionProgress.done} total={sectionProgress.total} showLabel={false} showPercent={false}
                        ariaLabel={sectionLabel ?? kind} />
                    <span className="text-xs tabular-nums text-muted whitespace-nowrap">{sectionProgress.done} / {sectionProgress.total} {(sectionLabel ?? kind).toLowerCase()}</span>
                </div>
            )}
            {meta.length > 0 && <p className="flex flex-wrap gap-x-3 text-xs text-muted">{meta.map((m) => <span key={m}>{m}</span>)}</p>}
        </header>
    );
}
