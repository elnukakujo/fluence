import { useTranslations } from "next-intl";
import type HomeStats from "@/interface/dataCollection/HomeStats";
import ProgressBar from "@/components/ui/progressBar";

/** Streak, today's answers against the learner's minimum, and the fading items across all languages. */
export default function HomeHeadline({ stats }: { stats: HomeStats }) {
    const t = useTranslations("home");
    const fading = stats.languages.reduce((n, l) => n + l.fading, 0);
    return (
        <section aria-label={t("headline")} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Tile label={t("streak")} value={t("streakDays", { count: stats.streak })} />
            <Tile className="col-span-2 order-first sm:order-none sm:col-span-1" label={t("today")} value={t("todayProgress", { answers: stats.today.answers, min: stats.today.min })}
                note={stats.today.validated ? t("streakDone") : undefined}
                bar={<ProgressBar current={Math.min(stats.today.answers, stats.today.min)} total={stats.today.min} showLabel={false} showPercent={false} thin accent
                    ariaLabel={t("todayProgress", { answers: stats.today.answers, min: stats.today.min })} />} />
            <Tile label={t("fading")} value={String(fading)} note={t("fadingHint")} />
        </section>
    );
}

function Tile({ label, value, note, bar, className = "" }: { label: string; value: string; note?: string; bar?: React.ReactNode; className?: string }) {
    return (
        <div className={`card flex flex-col gap-1 ${className}`}>
            <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
            <strong className="font-serif text-2xl text-ink">{value}</strong>
            {bar}
            {note && <span className="text-xs text-muted">{note}</span>}
        </div>
    );
}
