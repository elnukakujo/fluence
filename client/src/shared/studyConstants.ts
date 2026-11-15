// One source for study constants shared by server and client: shared/study-constants.json
// (synced here by `npm run sync-constants`; this copy is git-ignored). Keep values there only.
import constants from "./study-constants.json";

export const STUDY = constants;

export type Level = "learning" | "known" | "mastered";

/** The one score -> level mapping (same cut-offs as the server's `level_for`). */
export const levelFor = (score: number): Level =>
  score >= STUDY.levels.masteredFrom ? "mastered" : score >= STUDY.levels.knownFrom ? "known" : "learning";

export const isWeak = (score: number) => score < STUDY.levels.weakBelow;
