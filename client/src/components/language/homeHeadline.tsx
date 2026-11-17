import { useTranslations } from "next-intl";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFire, faHourglassHalf } from "@fortawesome/free-solid-svg-icons";
import type HomeStats from "@/interface/dataCollection/HomeStats";
import ProgressRing from "@/components/ui/progressRing";

/** Today's answers against the learner's minimum (the hero), the streak, and the fading items across all languages. */
export default function HomeHeadline({ stats }: { stats: HomeStats }) {
    const t = useTranslations("home");
    const fading = stats.languages.reduce((n, l) => n + l.fading, 0);
    const { answers, min, validated } = stats.today;
    return (
        <section aria-label={t("headline")} className="bento">
            <div className="card tile-hero tile-wide flex items-center gap-5">
                <ProgressRing value={answers} max={min} label={t("todayProgress", { answers, min })}>
                    <span className="tile-num">{answers}</span>
                </ProgressRing>
                <div className="flex min-w-0 flex-col gap-1">
                    <span className="tile-label">{t("today")}</span>
                    <strong className="font-serif text-xl text-ink">{t("todayProgress", { answers, min })}</strong>
                    <span className="text-sm text-muted">{validated ? t("streakDone") : t("todayHint", { left: Math.max(0, min - answers) })}</span>
                </div>
            </div>
            <Tile icon={faFire} label={t("streak")} value={t("streakDays", { count: stats.streak })} />
            <Tile icon={faHourglassHalf} label={t("fading")} value={String(fading)} note={t("fadingHint")} />
        </section>
    );
}

function Tile({ icon, label, value, note }: { icon: typeof faFire; label: string; value: string; note?: string }) {
    return (
        <div className="card flex flex-col justify-between gap-2">
            <span className="tile-label flex items-center gap-2"><FontAwesomeIcon icon={icon} className="size-4 text-accent" aria-hidden />{label}</span>
            <strong className="tile-num">{value}</strong>
            {note && <span className="text-xs text-muted">{note}</span>}
        </div>
    );
}
