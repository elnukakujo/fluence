"use client";

/** Before the flip: pick the right one of two look-alikes. Wrong or right, the card goes on. */
export default function LeechChoice({ prompt, options, onPick }: { prompt: string; options: { label: string; correct: boolean }[]; onPick: (correct: boolean) => void }) {
    return (
        <section className="card flex flex-col gap-3">
            <p className="font-medium">{prompt}</p>
            <div className="flex flex-wrap gap-2">
                {options.map((o) => (
                    <button key={o.label} type="button" className="btn btn-secondary min-h-11 text-lg" onClick={() => onPick(o.correct)}>{o.label}</button>
                ))}
            </div>
        </section>
    );
}
