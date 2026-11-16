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

/** Days until an element's effective score halves its way down to the lower edge of its band (score * 0.5^(d/stability) = edge).
 *  null when already weak or never seen; capped at FADING_CAP (shown as "99+"). */
export function fadingDays(score: number, stability: number): number | null {
  const { weakBelow, knownFrom, masteredFrom } = STUDY.levels;
  const edge = score >= masteredFrom ? masteredFrom : score >= knownFrom ? knownFrom : weakBelow;
  if (score < weakBelow || stability <= 0) return null;
  return Math.min(FADING_CAP, Math.round(stability * Math.log2(score / edge)));
}
