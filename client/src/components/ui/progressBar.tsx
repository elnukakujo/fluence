type ProgressBarProps = {
    current: number;
    total: number;
    showLabel?: boolean;
    showPercent?: boolean;
    /** Replaces the default "current / total" text (e.g. "4 of 12 pages read"). */
    label?: string;
    className?: string;
    /** Accessible name of the bar (use when showLabel is off). */
    ariaLabel?: string;
    /** Use the accent colour instead of the gradient (a second bar next to the main one). */
    accent?: boolean;
    /** Exact numbers on hover / long-press, e.g. "Calligraphy 1 / 10". */
    title?: string;
    /** Thin bar for dense places (headers, table rows). */
    thin?: boolean;
    /** Moving highlight: for work that is running right now (a job), not for progress you make yourself. */
    active?: boolean;
    /** Length unknown: the bar slides instead of filling, and carries no value. */
    indeterminate?: boolean;
};

export default function ProgressBar({
    current,
    total,
    showLabel = true,
    showPercent = true,
    label,
    className = "",
    ariaLabel,
    accent = false,
    title,
    thin = false,
    active = false,
    indeterminate = false,
}: ProgressBarProps) {
    const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

    return (
        <div className={`flex flex-col gap-1.5 ${className}`}>
            {(showLabel || showPercent) && (
                <div className="flex justify-between text-sm" style={{ color: "var(--color-muted)" }}>
                    {showLabel && <span>{label ?? `${current} / ${total}`}</span>}
                    {showPercent && !indeterminate && <span>{percent}%</span>}
                </div>
            )}
            <div className={`progress-bar-track${thin ? " is-sm" : ""}`} title={title}>
                <div
                    className={`progress-bar-fill${accent ? " is-accent" : ""}${active || indeterminate ? " is-active" : ""}${indeterminate ? " is-indeterminate" : ""}`}
                    style={indeterminate ? undefined : { width: `${percent}%` }}
                    role="progressbar"
                    aria-label={ariaLabel}
                    aria-valuenow={indeterminate ? undefined : current}
                    aria-valuemin={0}
                    aria-valuemax={total}
                />
            </div>
        </div>
    );
}
