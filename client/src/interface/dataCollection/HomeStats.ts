export type LanguageSummary = {
  id: string;
  name: string;
  levels: { learning: number; known: number; mastered: number };
  fading: number;
  /** Share of the language's elements ever seen (0..1). Never mixed with `mean_seen` (DM-7). */
  coverage: number;
  /** Mean score of the seen elements only; null when nothing was seen yet. */
  mean_seen: number | null;
  due: number;
  due_minutes: number;
  minutes_today: number;
};

type HomeStats = {
  streak: number;
  today: { answers: number; min: number; validated: boolean };
  languages: LanguageSummary[];
  weeks: { week_start: string; answers: number }[];
  /** Upper edges of heatmap bands 1..3 (band 4 is above); relative to the learner's median busy day. */
  heatmap_bands: number[];
  week_delta: number;
};

export default HomeStats;
