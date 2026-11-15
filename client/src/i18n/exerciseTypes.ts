import typeMeta from "@/shared/exercise-types.json";

// Exercise type ids (sent to the API) -> key in the `exercises` message namespace.
export const EXERCISE_TYPE_KEY: Record<string, string> = Object.fromEntries(typeMeta.map((t) => [t.name, t.i18nKey]));
