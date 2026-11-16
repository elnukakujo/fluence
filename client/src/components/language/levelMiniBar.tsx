import { useTranslations } from "next-intl";

type Levels = { learning: number; known: number; mastered: number };

/** Three segments (learning / known / mastered) sized by count. The numbers are always written out, so the colours are never the only signal. */
export default function LevelMiniBar({ learning, known, mastered }: Levels) {
    const t = useTranslations("home");
    const total = learning + known + mastered;
    const parts = [
        { key: "learning", n: learning, cls: "bg-muted/60" },
        { key: "known", n: known, cls: "bg-accent-soft" },
        { key: "mastered", n: mastered, cls: "bg-accent" },
    ] as const;
    const summary = parts.map((p) => `${t(`level.${p.key}`)} ${p.n}`).join(", ");
    return (
        <div className="flex flex-col gap-1">
            <div role="img" aria-label={summary} className="flex h-2 w-full overflow-hidden rounded-full bg-border/40">
                {total > 0 && parts.map((p) => p.n > 0 && <span key={p.key} className={p.cls} style={{ width: `${(p.n / total) * 100}%` }} />)}
            </div>
            <ul className="flex list-none flex-wrap gap-x-3 pl-0 text-xs text-muted">
                {parts.map((p) => <li key={p.key}>{t(`level.${p.key}`)} <strong className="text-ink">{p.n}</strong></li>)}
            </ul>
        </div>
    );
}
