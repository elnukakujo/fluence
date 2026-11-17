type Props = {
    value: number;
    max: number;
    /** Accessible name of the whole ring (the numbers inside are decorative for a screen reader). */
    label: string;
    size?: number;
    stroke?: number;
    children?: React.ReactNode;
};

/** A circular progress meter with room for a number in its middle. The fill is capped at 100 %; the ring never carries the value alone (the caller prints it). */
export default function ProgressRing({ value, max, label, size = 120, stroke = 10, children }: Props) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
    return (
        <div className="progress-ring" style={{ width: size, height: size }} role="img" aria-label={label}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
                <circle className="progress-ring-fill" cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-accent)" strokeWidth={stroke}
                    strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
            </svg>
            <div className="progress-ring-center" aria-hidden>{children}</div>
        </div>
    );
}
