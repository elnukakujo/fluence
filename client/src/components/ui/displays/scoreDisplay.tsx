import { useTranslations } from "next-intl";

interface ScoreDisplayProps {
  score: number; // 0–100
  /** Hide the leading "Score" word (when a table header already names the column). */
  hideLabel?: boolean;
}

type LevelConfig = {
  test: (s: number) => boolean;
  labelKey: string;
  pip: string;
  text: string;
};

const LEVELS_CONFIG: LevelConfig[] = [
  { test: (s: number) => s === 0,  labelKey: "unstarted",   pip: "bg-muted",    text: "text-muted"   },
  { test: (s: number) => s < 75,   labelKey: "inProgress", pip: "bg-warning",  text: "text-warning" },
  { test: (s: number) => s < 100,  labelKey: "revisiting",  pip: "bg-accent",   text: "text-accent"  },
  { test: (_: number) => true,     labelKey: "completed",   pip: "bg-success",  text: "text-success" },
] as const;

const PIPS = 5;

import PipBar from "./pipBar";

export default function ScoreDisplay({ score, hideLabel }: ScoreDisplayProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const levelConfig = LEVELS_CONFIG.find((l) => l.test(clamped))!;
  const t = useTranslations("ui");
  const label = t(levelConfig.labelKey);
  const filledPips = clamped === 0 ? 0 : Math.max(1, Math.round((clamped / 100) * PIPS));

  return (
    <div className="inline-flex items-center gap-2">
      {!hideLabel && <span className="text-sm text-muted">{t("score")}</span>}

      <PipBar filled={filledPips} pip={levelConfig.pip} label={t("score")} value={`${Number(clamped.toFixed(1))} / 100`} />

      <span className={`text-xs font-medium ${levelConfig.text}`}>
        {label}
      </span>
    </div>
  );
}