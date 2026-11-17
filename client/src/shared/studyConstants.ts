// One source for study constants shared by server and client: shared/study-constants.json
// (synced here by `npm run sync-constants`; this copy is git-ignored). Keep values there only.
import constants from "./study-constants.json";

export const STUDY = constants;

export type Level = "learning" | "known" | "mastered";

/** The one score -> level mapping (same cut-offs as the server's `level_for`). */
export const levelFor = (score: number): Level =>
  score >= STUDY.levels.masteredFrom ? "mastered" : score >= STUDY.levels.knownFrom ? "known" : "learning";

export const isWeak = (score: number) => score < STUDY.levels.weakBelow;

export const FADING_CAP = 99;

/** Days until an element's effective score leaves its band: score * 0.5^(d/stability) = the band's lower edge (mastered -> 85, known -> 60,
 *  learning from the weak mark up -> 40). Below the weak mark there is no lower edge, so the estimate is the half-life (the score halves in
 *  `stability` days) - TODO(owner): RD-72. null when never seen; capped at FADING_CAP (shown as "99+"). */
export function fadingDays(score: number, stability: number): number | null {
  const { weakBelow, knownFrom, masteredFrom } = STUDY.levels;
  if (score <= 0 || stability <= 0) return null;
  if (score < weakBelow) return Math.min(FADING_CAP, Math.round(stability));
  const edge = score >= masteredFrom ? masteredFrom : score >= knownFrom ? knownFrom : weakBelow;
  return Math.min(FADING_CAP, Math.round(stability * Math.log2(score / edge)));
}
