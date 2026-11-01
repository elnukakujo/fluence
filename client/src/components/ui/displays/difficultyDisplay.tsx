import { useTranslations } from "next-intl";

interface DifficultyScoreProps {
  difficulty: number; // 0 (easy) → 1 (hard)
}

type LevelConfig = {
  max: number;
  labelKey: string;
  pip: string;
  text: string;
};

const LEVELS_CONFIG: LevelConfig[] = [
  { max: 0.25, labelKey: "hard",    pip: "bg-danger",  text: "text-danger"  },
  { max: 0.5,  labelKey: "medium",  pip: "bg-accent",  text: "text-accent"  },
  { max: 0.75, labelKey: "easy",    pip: "bg-warning",   text: "text-warning"   },
  { max: 1.0,  labelKey: "trivial",  pip: "bg-success",   text: "text-success"   },
] as const;

const PIPS = 5;

export default function DifficultyDisplay({ difficulty }: DifficultyScoreProps) {
  const clamped = Math.max(0, Math.min(1, difficulty));
  const levelConfig = LEVELS_CONFIG.find((l) => clamped <= l.max) ?? LEVELS_CONFIG[LEVELS_CONFIG.length - 1];
  const t = useTranslations("ui");
  const label = t(levelConfig.labelKey);
  const filledPips = Math.round(clamped * PIPS);

  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-sm text-muted">{t("difficulty")}</span>

      <div className="flex items-center gap-0.5">
        {Array.from({ length: PIPS }).map((_, i) => (
          <span
            key={i}
            className={`block w-1 h-3 rounded-full ${i < filledPips ? levelConfig.pip : "bg-border"}`}
          />
        ))}
      </div>

      <span className={`text-xs font-medium ${levelConfig.text}`}>
        {label}
      </span>
    </div>
  );
}