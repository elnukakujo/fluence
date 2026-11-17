import { useTranslations } from "next-intl";

interface ScoreDisplayProps {
  score: number; // 0–100
  /** Days for the score to halve; with it the display adds when the element will drop out of its band. */
  stability?: number;
  /** Hide the leading "Score" word (when a table header already names the column). */
  hideLabel?: boolean;
}

const LEVEL_STYLE: Record<Level, { pip: string; text: string }> = {
  learning: { pip: "bg-warning", text: "text-warning" },
  known:    { pip: "bg-accent",  text: "text-accent"  },
  mastered: { pip: "bg-success", text: "text-success" },
};

const PIPS = 5;

import PipBar from "./pipBar";
import { levelFor, isWeak, fadingDays, FADING_CAP, type Level } from "@/shared/studyConstants";

export default function ScoreDisplay({ score, hideLabel, stability }: ScoreDisplayProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const level = levelFor(clamped);
  const weak = isWeak(clamped);
  const levelConfig = LEVEL_STYLE[level];
  const t = useTranslations("ui");
  const label = clamped === 0 ? t("levelUnseen") : weak ? t("levelWeak") : t(`level${level[0].toUpperCase()}${level.slice(1)}`);
  const fading = stability != null ? fadingDays(clamped, stability) : null;
  const filledPips = clamped === 0 ? 0 : Math.max(1, Math.round((clamped / 100) * PIPS));

  return (
    <div className="inline-flex items-center gap-2">
      {!hideLabel && <span className="text-sm text-muted">{t("score")}</span>}

      <PipBar filled={filledPips} pip={levelConfig.pip} label={t("score")} value={`${Number(clamped.toFixed(1))} / 100`} />

      <span className={`text-xs font-medium ${levelConfig.text}`}>
        {label}
      </span>
      {fading != null && <span className="text-xs text-muted">{t("fadingIn", { days: fading >= FADING_CAP ? `${FADING_CAP}+` : fading })}</span>}
    </div>
  );
}